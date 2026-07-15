import 'dart:async';

import 'package:flutter/foundation.dart';

import '../data/exam_repository.dart';
import '../models/models.dart';

class AppController extends ChangeNotifier {
  AppController(this.repository);

  final ExamRepository repository;
  String? authenticationError;
  bool isLoggedIn = false;
  bool isAuthenticating = false;
  bool isOnline = true;
  int homeTab = 0;
  Exam? activeExam;
  int currentQuestion = 0;
  int remainingSeconds = 0;
  bool submittedOffline = false;
  int integrityEvents = 0;
  final Map<String, String> answers = {};
  final Set<String> flagged = {};
  Timer? _timer;

  StudentProfile get profile => repository.profile;
  List<Exam> get exams => repository.exams;
  List<ExamQuestion> get questions => repository.questions;
  int get answeredCount =>
      answers.values.where((value) => value.trim().isNotEmpty).length;
  int get unsyncedCount => isOnline ? 0 : answers.length;

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
    await repository.signOut();
    isLoggedIn = false;
    homeTab = 0;
    notifyListeners();
  }

  Future<void> refreshExams() async {
    await repository.refreshExams();
    notifyListeners();
  }

  void setTab(int index) {
    homeTab = index;
    notifyListeners();
  }

  void toggleConnection() {
    isOnline = !isOnline;
    notifyListeners();
  }

  void startExam(Exam exam) {
    activeExam = exam;
    currentQuestion = 0;
    remainingSeconds = exam.durationMinutes * 60;
    answers.clear();
    flagged.clear();
    integrityEvents = 0;
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (remainingSeconds > 0) {
        remainingSeconds--;
        notifyListeners();
      } else {
        submitExam();
      }
    });
    notifyListeners();
  }

  void answer(String questionId, String value) {
    answers[questionId] = value;
    notifyListeners();
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

  void recordIntegrityEvent() {
    if (activeExam == null) return;
    integrityEvents++;
    notifyListeners();
  }

  void submitExam() {
    _timer?.cancel();
    submittedOffline = !isOnline;
    notifyListeners();
  }

  void closeAttempt() {
    activeExam = null;
    currentQuestion = 0;
    homeTab = 1;
    notifyListeners();
  }

  String get formattedTime {
    final hours = remainingSeconds ~/ 3600;
    final minutes = (remainingSeconds % 3600) ~/ 60;
    final seconds = remainingSeconds % 60;
    return '${hours.toString().padLeft(2, '0')}:${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}
