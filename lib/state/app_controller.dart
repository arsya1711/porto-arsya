import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';

import '../data/app_version.dart';
import '../data/attempt_draft_store.dart';
import '../data/exam_repository.dart';
import '../models/models.dart';

class AppController extends ChangeNotifier {
  AppController(
    this.repository, {
    AttemptDraftStore? draftStore,
    DateTime Function()? clock,
    this.currentVersion,
  }) : draftStore = draftStore ?? InMemoryAttemptDraftStore(),
       _now = clock ?? DateTime.now;

  /// Versi aplikasi yang sedang berjalan; null berarti gerbang versi dilewati.
  final String? currentVersion;

  /// Sumber waktu; dapat diganti pada pengujian untuk mensimulasikan suspensi.
  final DateTime Function() _now;

  static const _maxAutoSubmitAttempts = 5;
  static const _answerRetryBaseDelay = Duration(seconds: 5);
  static const _answerRetryMaxDelay = Duration(seconds: 60);
  static const _answerRetryConcurrency = 4;
  static const _draftPersistDelay = Duration(milliseconds: 200);

  final ExamRepository repository;
  final AttemptDraftStore draftStore;
  String? authenticationError;
  String? operationError;
  bool isLoggedIn = false;
  bool isInitializing = false;
  bool updateRequired = false;
  String? minimumVersion;
  bool isAuthenticating = false;
  bool isStartingExam = false;
  bool isSubmitting = false;
  bool submissionCompleted = false;
  String? submissionWarning;
  bool autoSubmitExhausted = false;
  bool isOnline = true;
  int homeTab = 0;
  Exam? activeExam;
  String? activeAttemptId;
  int currentQuestion = 0;
  int remainingSeconds = 0;
  int integrityEvents = 0;
  final Map<String, String> answers = {};
  final Set<String> flagged = {};
  final Set<String> _unsyncedQuestionIds = {};
  final Map<String, Timer> _answerSaveTimers = {};
  final Map<String, Future<bool>> _pendingAnswerSaves = {};
  List<ExamQuestion> _questions = const [];
  Timer? _countdownTimer;
  Timer? _draftPersistTimer;
  Timer? _answerRetryTimer;
  Timer? _autoSubmitRetryTimer;
  Future<void> _draftWriteQueue = Future<void>.value();
  DateTime? _deadline;
  Duration _serverClockOffset = Duration.zero;
  int _autoSubmitAttempts = 0;
  int _answerRetryRound = 0;
  String? _retryingAttemptId;

  StudentProfile get profile => repository.profile;
  List<Exam> get exams => repository.exams;
  List<ExamQuestion> get questions => _questions;
  int get answeredCount =>
      answers.values.where((value) => value.trim().isNotEmpty).length;
  int get unsyncedCount => _unsyncedQuestionIds.length;

  Future<void> initialize() async {
    isInitializing = true;
    notifyListeners();
    try {
      await _checkSupportedVersion();
      if (updateRequired) return;
      isLoggedIn = await repository.restoreSession();
      if (isLoggedIn) {
        try {
          await repository.refreshExams();
          isOnline = true;
          operationError = null;
        } catch (_) {
          isOnline = false;
          operationError =
              'Sesi dipulihkan, tetapi jadwal ujian belum dapat dimuat. Coba muat ulang.';
        }
      }
    } finally {
      isInitializing = false;
      notifyListeners();
    }
  }

  /// Gerbang versi sengaja gagal terbuka: kegagalan jaringan atau konfigurasi
  /// yang tidak valid tidak boleh menghalangi siswa mengikuti ujian.
  Future<void> _checkSupportedVersion() async {
    final version = currentVersion;
    if (version == null) return;
    try {
      minimumVersion = await repository.minimumSupportedVersion();
      updateRequired = isUpdateRequired(
        currentVersion: version,
        minimumVersion: minimumVersion,
      );
    } catch (_) {
      updateRequired = false;
    }
  }

  Future<bool> login(String username, String password) async {
    isAuthenticating = true;
    authenticationError = null;
    notifyListeners();
    try {
      await repository.authenticate(username, password);
      isLoggedIn = true;
      try {
        await repository.refreshExams();
        isOnline = true;
        operationError = null;
      } catch (_) {
        // Session login tetap sah. Pengguna masuk dengan katalog kosong dan
        // dapat mencoba lagi melalui pull-to-refresh/tombol muat ulang.
        isOnline = false;
        operationError =
            'Login berhasil, tetapi jadwal ujian belum dapat dimuat. Coba muat ulang.';
      }
      return true;
    } on AuthenticationException catch (error) {
      authenticationError = error.message;
      return false;
    } catch (_) {
      authenticationError =
          'Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.';
      return false;
    } finally {
      isAuthenticating = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    await _clearDraft();
    _resetAttempt();
    try {
      await repository.signOut();
    } finally {
      isLoggedIn = false;
      homeTab = 0;
      notifyListeners();
    }
  }

  Future<void> refreshExams() async {
    try {
      await repository.refreshExams();
      isOnline = true;
      operationError = null;
    } catch (_) {
      isOnline = false;
      operationError =
          'Jadwal belum dapat diperbarui. Periksa koneksi lalu coba lagi.';
      rethrow;
    } finally {
      notifyListeners();
    }
  }

  void setTab(int index) {
    homeTab = index;
    notifyListeners();
  }

  Future<bool> startExam(Exam exam, {String? accessCode}) async {
    if (isStartingExam) return false;
    isStartingExam = true;
    operationError = null;
    notifyListeners();
    try {
      final session = await repository.startExam(
        exam.id,
        accessCode: accessCode,
      );
      if (session.questions.isEmpty) {
        throw const ExamOperationException('Soal ujian belum tersedia.');
      }

      // Dibaca sebelum _resetAttempt agar draft attempt yang sama tidak hilang.
      final draft = await _loadDraft(session.attemptId);

      _resetAttempt();
      activeExam = exam;
      activeAttemptId = session.attemptId;
      _questions = session.questions;
      answers.addAll(session.savedAnswers);
      _restoreDraft(draft);
      _deadline = session.deadline;
      _serverClockOffset = session.serverNow.difference(_now());
      remainingSeconds = _computeRemainingSeconds();
      submissionCompleted = false;
      isOnline = true;
      _startCountdown();
      _flushRecoveredAnswers();
      return true;
    } on ExamOperationException catch (error) {
      operationError = error.message;
      return false;
    } catch (_) {
      operationError =
          'Tidak dapat memulai ujian. Periksa koneksi lalu coba lagi.';
      return false;
    } finally {
      isStartingExam = false;
      notifyListeners();
    }
  }

  int _computeRemainingSeconds() {
    final deadline = _deadline;
    if (deadline == null) return 0;
    final milliseconds = deadline
        .difference(_now().add(_serverClockOffset))
        .inMilliseconds;
    if (milliseconds <= 0) return 0;
    // Pembulatan ke atas mencegah auto-submit sampai 999 ms terlalu dini.
    return ((milliseconds + 999) ~/ 1000).clamp(0, 1 << 31);
  }

  /// Menghitung ulang sisa waktu dari deadline server.
  ///
  /// Timer periodik berhenti selama aplikasi disuspensi OS, sehingga hitungan
  /// lokal bisa tertinggal jauh dari waktu sebenarnya. Dipanggil setiap tick dan
  /// setiap aplikasi kembali ke foreground.
  void syncRemainingSeconds() {
    if (_deadline == null) return;
    final next = _computeRemainingSeconds();
    if (next != remainingSeconds) {
      remainingSeconds = next;
      notifyListeners();
    }
    _autoSubmitIfExpired();
  }

  Future<void> refreshServerClock() async {
    final attemptId = activeAttemptId;
    if (attemptId == null || submissionCompleted) return;
    try {
      final serverNow = await repository.serverTime();
      if (serverNow == null || activeAttemptId != attemptId) return;
      _serverClockOffset = serverNow.difference(_now());
      syncRemainingSeconds();
    } catch (_) {
      // Countdown tetap berjalan memakai offset terakhir. Backend selalu
      // menegakkan deadline walau sinkronisasi clock sementara gagal.
    }
  }

  void _startCountdown() {
    _countdownTimer?.cancel();
    _countdownTimer = Timer.periodic(
      const Duration(seconds: 1),
      (_) => syncRemainingSeconds(),
    );
  }

  void _autoSubmitIfExpired() {
    if (remainingSeconds > 0 || isSubmitting || submissionCompleted) return;
    _countdownTimer?.cancel();
    _countdownTimer = null;
    unawaited(_runAutoSubmit());
  }

  /// Auto-submit dengan backoff berbatas agar kegagalan jaringan tidak memicu
  /// percobaan kirim setiap detik tanpa henti.
  Future<void> _runAutoSubmit() async {
    if (_autoSubmitRetryTimer != null ||
        isSubmitting ||
        submissionCompleted ||
        autoSubmitExhausted) {
      return;
    }
    _autoSubmitAttempts++;
    if (await submitExam()) return;
    if (_autoSubmitAttempts >= _maxAutoSubmitAttempts) {
      autoSubmitExhausted = true;
      operationError =
          'Ujian belum dapat dikumpulkan otomatis. Periksa koneksi lalu tekan tombol kumpulkan.';
      notifyListeners();
      return;
    }
    _autoSubmitRetryTimer = Timer(
      Duration(seconds: 1 << (_autoSubmitAttempts - 1)),
      () {
        _autoSubmitRetryTimer = null;
        unawaited(_runAutoSubmit());
      },
    );
  }

  void answer(String questionId, String value, {bool debounce = false}) {
    final question = _questionById(questionId);
    if (question == null ||
        activeAttemptId == null ||
        isSubmitting ||
        remainingSeconds <= 0) {
      return;
    }

    answers[questionId] = value;
    _unsyncedQuestionIds.add(questionId);
    operationError = null;
    _answerSaveTimers.remove(questionId)?.cancel();
    if (debounce) {
      _answerSaveTimers[questionId] = Timer(
        const Duration(milliseconds: 600),
        () => unawaited(_enqueueAnswerSave(question, value)),
      );
    } else {
      unawaited(_enqueueAnswerSave(question, value));
    }
    _scheduleDraftPersist();
    notifyListeners();
  }

  Future<bool> _enqueueAnswerSave(
    ExamQuestion question,
    String value, {
    bool notify = true,
  }) {
    final attemptId = activeAttemptId;
    if (attemptId == null) return Future<bool>.value(false);
    final previous =
        _pendingAnswerSaves[question.id] ?? Future<bool>.value(true);
    late final Future<bool> queued;
    queued = previous.then(
      (_) => _persistAnswer(attemptId, question, value, notify: notify),
    );
    _pendingAnswerSaves[question.id] = queued;
    unawaited(
      queued.then((_) {
        if (identical(_pendingAnswerSaves[question.id], queued)) {
          _pendingAnswerSaves.remove(question.id);
        }
      }),
    );
    return queued;
  }

  Future<bool> _persistAnswer(
    String attemptId,
    ExamQuestion question,
    String value, {
    bool notify = true,
  }) async {
    try {
      await repository.saveAnswer(
        attemptId: attemptId,
        question: question,
        value: value,
      );
      if (activeAttemptId != attemptId) return false;
      if (answers[question.id] == value) {
        _unsyncedQuestionIds.remove(question.id);
        _scheduleDraftPersist();
      }
      isOnline = true;
      if (_unsyncedQuestionIds.isEmpty) {
        operationError = null;
        _answerRetryRound = 0;
        _answerRetryTimer?.cancel();
        _answerRetryTimer = null;
      } else {
        _scheduleUnsyncedRetry();
      }
      if (notify) notifyListeners();
      return true;
    } on ExamOperationException catch (error) {
      if (activeAttemptId != attemptId) return false;
      isOnline = false;
      operationError = error.message;
      _scheduleUnsyncedRetry();
      if (notify) notifyListeners();
      return false;
    } catch (_) {
      if (activeAttemptId != attemptId) return false;
      isOnline = false;
      operationError = 'Jawaban belum tersimpan. Periksa koneksi internet.';
      _scheduleUnsyncedRetry();
      if (notify) notifyListeners();
      return false;
    }
  }

  void _scheduleUnsyncedRetry() {
    if (_answerRetryTimer != null ||
        _retryingAttemptId != null ||
        _unsyncedQuestionIds.isEmpty ||
        activeAttemptId == null ||
        remainingSeconds <= 0 ||
        isSubmitting) {
      return;
    }
    final exponentialSeconds = math.min(
      _answerRetryMaxDelay.inSeconds,
      _answerRetryBaseDelay.inSeconds * (1 << math.min(_answerRetryRound, 4)),
    );
    final attemptHash = activeAttemptId.hashCode;
    final jitterMilliseconds =
        ((attemptHash ^ (_answerRetryRound * 997)) & 0x7fffffff) % 1500;
    final delay = Duration(
      seconds: exponentialSeconds,
      milliseconds: jitterMilliseconds,
    );
    _answerRetryTimer = Timer(delay, () {
      _answerRetryTimer = null;
      unawaited(retryUnsyncedAnswers());
    });
  }

  /// Mencoba ulang seluruh jawaban lokal, dipanggil oleh timer dan ketika
  /// aplikasi kembali ke foreground setelah jaringan mungkin telah pulih.
  Future<void> retryUnsyncedAnswers() async {
    if (_retryingAttemptId != null) return;
    _answerRetryTimer?.cancel();
    _answerRetryTimer = null;
    final retryAttemptId = activeAttemptId;
    if (_unsyncedQuestionIds.isEmpty ||
        retryAttemptId == null ||
        remainingSeconds <= 0 ||
        isSubmitting) {
      return;
    }
    _retryingAttemptId = retryAttemptId;

    try {
      final questionIds = _unsyncedQuestionIds.toList(growable: false);
      for (
        var offset = 0;
        offset < questionIds.length;
        offset += _answerRetryConcurrency
      ) {
        if (activeAttemptId != retryAttemptId || isSubmitting) return;
        final end = math.min(
          offset + _answerRetryConcurrency,
          questionIds.length,
        );
        final retries = <Future<bool>>[];
        for (final questionId in questionIds.sublist(offset, end)) {
          final question = _questionById(questionId);
          final value = answers[questionId];
          if (question != null && value != null) {
            retries.add(_enqueueAnswerSave(question, value, notify: false));
          }
        }
        await Future.wait(retries);
      }
    } finally {
      if (_retryingAttemptId == retryAttemptId) {
        _retryingAttemptId = null;
      }
    }
    if (activeAttemptId != retryAttemptId) return;
    if (_unsyncedQuestionIds.isNotEmpty) {
      _answerRetryRound++;
      _scheduleUnsyncedRetry();
    } else {
      _answerRetryRound = 0;
    }
    notifyListeners();
  }

  Future<AttemptDraft?> _loadDraft(String attemptId) async {
    try {
      return await draftStore.load(attemptId);
    } catch (_) {
      return null;
    }
  }

  /// Menimpa jawaban server dengan jawaban lokal yang belum sempat tersinkron.
  void _restoreDraft(AttemptDraft? draft) {
    if (draft == null) return;
    for (final questionId in draft.unsyncedQuestionIds) {
      final value = draft.answers[questionId];
      if (value == null || _questionById(questionId) == null) continue;
      answers[questionId] = value;
      _unsyncedQuestionIds.add(questionId);
    }
    flagged.addAll(draft.flagged.where((id) => _questionById(id) != null));
  }

  void _flushRecoveredAnswers() {
    for (final questionId in _unsyncedQuestionIds.toList(growable: false)) {
      final question = _questionById(questionId);
      final value = answers[questionId];
      if (question == null || value == null) continue;
      unawaited(_enqueueAnswerSave(question, value, notify: false));
    }
  }

  AttemptDraft? _draftSnapshot() {
    final attemptId = activeAttemptId;
    if (attemptId == null) return null;
    return AttemptDraft(
      attemptId: attemptId,
      answers: Map.of(answers),
      unsyncedQuestionIds: Set.of(_unsyncedQuestionIds),
      flagged: Set.of(flagged),
    );
  }

  void _scheduleDraftPersist() {
    if (activeAttemptId == null) return;
    _draftPersistTimer?.cancel();
    _draftPersistTimer = Timer(_draftPersistDelay, () {
      _draftPersistTimer = null;
      unawaited(flushDraft());
    });
  }

  /// Menulis snapshot draft secara berurutan agar write lama tidak dapat
  /// menimpa jawaban yang lebih baru. Dipanggil juga saat aplikasi masuk
  /// background supaya debounce yang belum selesai tetap diamankan.
  Future<void> flushDraft() {
    _draftPersistTimer?.cancel();
    _draftPersistTimer = null;
    final draft = _draftSnapshot();
    if (draft == null) return _draftWriteQueue;
    final operation = _draftWriteQueue.then((_) async {
      try {
        await draftStore.save(draft);
      } catch (_) {
        // Draft bersifat best-effort; jawaban tetap ada di memori dan server.
      }
    });
    _draftWriteQueue = operation;
    return operation;
  }

  Future<void> _clearDraft() async {
    _draftPersistTimer?.cancel();
    _draftPersistTimer = null;
    final operation = _draftWriteQueue.then((_) async {
      try {
        await draftStore.clear();
      } catch (_) {
        // Diabaikan; draft basi akan tersaring oleh pencocokan attemptId.
      }
    });
    _draftWriteQueue = operation;
    await operation;
  }

  ExamQuestion? _questionById(String questionId) {
    for (final question in _questions) {
      if (question.id == questionId) return question;
    }
    return null;
  }

  void toggleFlag(String questionId) {
    flagged.contains(questionId)
        ? flagged.remove(questionId)
        : flagged.add(questionId);
    _scheduleDraftPersist();
    notifyListeners();
  }

  void goToQuestion(int index) {
    if (index < 0 || index >= questions.length) return;
    currentQuestion = index;
    notifyListeners();
  }

  Future<bool> recordIntegrityEvent({
    String eventType = 'app_backgrounded',
  }) async {
    final attemptId = activeAttemptId;
    final exam = activeExam;
    if (attemptId == null ||
        exam == null ||
        submissionCompleted ||
        !exam.recordIntegrityEvents) {
      return false;
    }
    try {
      await repository.recordIntegrityEvent(
        attemptId: attemptId,
        examId: exam.id,
        eventType: eventType,
      );
      if (activeAttemptId != attemptId || submissionCompleted) return false;
      integrityEvents++;
      notifyListeners();
      return true;
    } catch (_) {
      if (activeAttemptId == attemptId && !submissionCompleted) {
        operationError = 'Aktivitas integritas belum dapat dicatat.';
        notifyListeners();
      }
      return false;
    }
  }

  Future<bool> submitExam() async {
    final attemptId = activeAttemptId;
    if (attemptId == null || isSubmitting) return false;
    if (submissionCompleted) return true;

    isSubmitting = true;
    operationError = null;
    submissionWarning = null;
    autoSubmitExhausted = false;
    _answerRetryTimer?.cancel();
    _answerRetryTimer = null;
    for (final timer in _answerSaveTimers.values) {
      timer.cancel();
    }
    _answerSaveTimers.clear();
    notifyListeners();

    try {
      await flushDraft();
      final expired = remainingSeconds == 0;
      final saves = <Future<bool>>[];
      for (final entry in answers.entries) {
        final question = _questionById(entry.key);
        if (question != null) {
          saves.add(_enqueueAnswerSave(question, entry.value, notify: false));
        }
      }
      final saved = await Future.wait(saves);
      final failedSaveCount = saved.where((success) => !success).length;
      if (failedSaveCount > 0) {
        if (!expired) {
          throw const ExamOperationException(
            'Masih ada jawaban yang belum tersimpan. Periksa koneksi lalu coba lagi.',
          );
        }
        submissionWarning =
            '$failedSaveCount jawaban lokal tidak sempat diterima server sebelum waktu berakhir dan mungkin tidak dinilai.';
      }

      await repository.submitExam(attemptId);
      _countdownTimer?.cancel();
      _countdownTimer = null;
      _unsyncedQuestionIds.clear();
      await _clearDraft();
      isOnline = true;
      operationError = null;
      submissionCompleted = true;
      return true;
    } on ExamOperationException catch (error) {
      operationError = error.message;
      return false;
    } catch (_) {
      operationError =
          'Ujian belum dapat dikumpulkan. Periksa koneksi lalu coba lagi.';
      return false;
    } finally {
      isSubmitting = false;
      notifyListeners();
    }
  }

  void closeAttempt() {
    unawaited(_clearDraft());
    _resetAttempt();
    homeTab = 1;
    notifyListeners();
  }

  void _resetAttempt() {
    _countdownTimer?.cancel();
    _countdownTimer = null;
    _draftPersistTimer?.cancel();
    _draftPersistTimer = null;
    _answerRetryTimer?.cancel();
    _answerRetryTimer = null;
    _answerRetryRound = 0;
    _retryingAttemptId = null;
    _autoSubmitRetryTimer?.cancel();
    _autoSubmitRetryTimer = null;
    _autoSubmitAttempts = 0;
    autoSubmitExhausted = false;
    _deadline = null;
    _serverClockOffset = Duration.zero;
    for (final timer in _answerSaveTimers.values) {
      timer.cancel();
    }
    _answerSaveTimers.clear();
    _pendingAnswerSaves.clear();
    activeExam = null;
    activeAttemptId = null;
    currentQuestion = 0;
    remainingSeconds = 0;
    integrityEvents = 0;
    submissionCompleted = false;
    submissionWarning = null;
    isSubmitting = false;
    answers.clear();
    flagged.clear();
    _unsyncedQuestionIds.clear();
    _questions = const [];
  }

  String get formattedTime {
    final hours = remainingSeconds ~/ 3600;
    final minutes = (remainingSeconds % 3600) ~/ 60;
    final seconds = remainingSeconds % 60;
    return '${hours.toString().padLeft(2, '0')}:${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
  }

  @override
  void dispose() {
    _resetAttempt();
    super.dispose();
  }
}
