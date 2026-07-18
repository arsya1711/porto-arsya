import 'dart:async';

import 'package:flutter/foundation.dart';

import '../data/exam_repository.dart';
import '../models/models.dart';

class AppController extends ChangeNotifier {
  AppController(this.repository);

  final ExamRepository repository;
  String? authenticationError;
  String? operationError;
  bool isLoggedIn = false;
  bool isInitializing = false;
  bool isAuthenticating = false;
  bool isStartingExam = false;
  bool isSubmitting = false;
  bool submissionCompleted = false;
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
      isLoggedIn = await repository.restoreSession();
    } finally {
      isInitializing = false;
      notifyListeners();
    }
  }

  Future<bool> login(String username, String password) async {
    isAuthenticating = true;
    authenticationError = null;
    notifyListeners();
    try {
      await repository.authenticate(username, password);
      isLoggedIn = true;
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

      _resetAttempt();
      activeExam = exam;
      activeAttemptId = session.attemptId;
      _questions = session.questions;
      answers.addAll(session.savedAnswers);
      remainingSeconds = session.deadline
          .difference(DateTime.now())
          .inSeconds
          .clamp(0, 1 << 31);
      submissionCompleted = false;
      isOnline = true;
      _startCountdown();
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

  void _startCountdown() {
    _countdownTimer?.cancel();
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (remainingSeconds > 0) {
        remainingSeconds--;
        notifyListeners();
      }
      if (remainingSeconds == 0 && !isSubmitting && !submissionCompleted) {
        _countdownTimer?.cancel();
        unawaited(submitExam());
      }
    });
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
            saves.add(
              _enqueueAnswerSave(question, entry.value, notify: false),
            );
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
      _unsyncedQuestionIds.clear();
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
    _resetAttempt();
    homeTab = 1;
    notifyListeners();
  }

  void _resetAttempt() {
    _countdownTimer?.cancel();
    _countdownTimer = null;
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
