import 'dart:async';

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
  Timer? _autoSubmitRetryTimer;
  DateTime? _deadline;
  int _autoSubmitAttempts = 0;

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
    _resetAttempt();
    await repository.signOut();
    isLoggedIn = false;
    homeTab = 0;
    notifyListeners();
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
    return deadline.difference(_now()).inSeconds.clamp(0, 1 << 31);
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
    if (question == null || activeAttemptId == null || isSubmitting) return;

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
    unawaited(_persistDraft());
    notifyListeners();
  }

  Future<bool> _enqueueAnswerSave(
    ExamQuestion question,
    String value, {
    bool notify = true,
  }) {
    final previous =
        _pendingAnswerSaves[question.id] ?? Future<bool>.value(true);
    late final Future<bool> queued;
    queued = previous.then(
      (_) => _persistAnswer(question, value, notify: notify),
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
    ExamQuestion question,
    String value, {
    bool notify = true,
  }) async {
    final attemptId = activeAttemptId;
    if (attemptId == null) return false;
    try {
      await repository.saveAnswer(
        attemptId: attemptId,
        question: question,
        value: value,
      );
      if (activeAttemptId != attemptId) return false;
      if (answers[question.id] == value) {
        _unsyncedQuestionIds.remove(question.id);
        unawaited(_persistDraft());
      }
      isOnline = true;
      if (notify) notifyListeners();
      return true;
    } on ExamOperationException catch (error) {
      if (activeAttemptId != attemptId) return false;
      isOnline = false;
      operationError = error.message;
      if (notify) notifyListeners();
      return false;
    } catch (_) {
      if (activeAttemptId != attemptId) return false;
      isOnline = false;
      operationError = 'Jawaban belum tersimpan. Periksa koneksi internet.';
      if (notify) notifyListeners();
      return false;
    }
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

  /// Draft bersifat best-effort: kegagalan menulis tidak boleh menghentikan ujian.
  Future<void> _persistDraft() async {
    final attemptId = activeAttemptId;
    if (attemptId == null) return;
    try {
      await draftStore.save(
        AttemptDraft(
          attemptId: attemptId,
          answers: Map.of(answers),
          unsyncedQuestionIds: Set.of(_unsyncedQuestionIds),
          flagged: Set.of(flagged),
        ),
      );
    } catch (_) {
      // Diabaikan; jawaban tetap tersimpan di memori dan dikirim ke server.
    }
  }

  Future<void> _clearDraft() async {
    try {
      await draftStore.clear();
    } catch (_) {
      // Diabaikan; draft basi akan tersaring oleh pencocokan attemptId.
    }
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
    unawaited(_persistDraft());
    notifyListeners();
  }

  void goToQuestion(int index) {
    if (index < 0 || index >= questions.length) return;
    currentQuestion = index;
    notifyListeners();
  }

  void recordIntegrityEvent({String eventType = 'app_backgrounded'}) {
    final attemptId = activeAttemptId;
    final exam = activeExam;
    if (attemptId == null || exam == null || submissionCompleted) return;
    integrityEvents++;
    notifyListeners();
    unawaited(
      repository
          .recordIntegrityEvent(
            attemptId: attemptId,
            examId: exam.id,
            eventType: eventType,
          )
          .catchError((_) {
            isOnline = false;
            operationError = 'Aktivitas integritas belum dapat dicatat.';
            notifyListeners();
          }),
    );
  }

  Future<bool> submitExam() async {
    final attemptId = activeAttemptId;
    if (attemptId == null || isSubmitting) return false;
    if (submissionCompleted) return true;

    isSubmitting = true;
    operationError = null;
    autoSubmitExhausted = false;
    for (final timer in _answerSaveTimers.values) {
      timer.cancel();
    }
    _answerSaveTimers.clear();
    notifyListeners();

    try {
      if (remainingSeconds == 0) {
        await Future.wait(_pendingAnswerSaves.values.toList());
      } else {
        final saves = <Future<bool>>[];
        for (final entry in answers.entries) {
          final question = _questionById(entry.key);
          if (question != null) {
            saves.add(_enqueueAnswerSave(question, entry.value, notify: false));
          }
        }
        final saved = await Future.wait(saves);
        if (saved.any((success) => !success)) {
          throw const ExamOperationException(
            'Masih ada jawaban yang belum tersimpan. Periksa koneksi lalu coba lagi.',
          );
        }
      }

      await repository.submitExam(attemptId);
      _countdownTimer?.cancel();
      _countdownTimer = null;
      _unsyncedQuestionIds.clear();
      await _clearDraft();
      isOnline = true;
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
    _autoSubmitRetryTimer?.cancel();
    _autoSubmitRetryTimer = null;
    _autoSubmitAttempts = 0;
    autoSubmitExhausted = false;
    _deadline = null;
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
