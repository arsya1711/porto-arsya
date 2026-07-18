import '../models/models.dart';

abstract interface class ExamRepository {
  StudentProfile get profile;
  List<Exam> get exams;

  Future<bool> restoreSession();
  Future<void> authenticate(String studentNumber, String password);
  Future<void> refreshExams();
  Future<ExamSession> startExam(String examId, {String? accessCode});
  Future<void> saveAnswer({
    required String attemptId,
    required ExamQuestion question,
    required String value,
  });
  Future<void> submitExam(String attemptId);
  Future<void> recordIntegrityEvent({
    required String attemptId,
    required String examId,
    required String eventType,
  });
  Future<void> signOut();
}

class AuthenticationException implements Exception {
  const AuthenticationException(this.message);

  final String message;

  @override
  String toString() => message;
}

class ExamOperationException implements Exception {
  const ExamOperationException(this.message);

  final String message;

  @override
  String toString() => message;
}

class UnavailableExamRepository implements ExamRepository {
  const UnavailableExamRepository();

  static const _configurationMessage =
      'Konfigurasi server AWExam belum tersedia pada aplikasi ini.';

  @override
  StudentProfile get profile => const StudentProfile(
    name: 'Siswa',
    studentNumber: '-',
    className: '-',
    school: 'Sekolah',
  );

  @override
  List<Exam> get exams => const [];

  @override
  Future<bool> restoreSession() async => false;

  @override
  Future<void> authenticate(String studentNumber, String password) {
    throw const AuthenticationException(_configurationMessage);
  }

  @override
  Future<void> refreshExams() {
    throw const ExamOperationException(_configurationMessage);
  }

  @override
  Future<ExamSession> startExam(String examId, {String? accessCode}) {
    throw const ExamOperationException(_configurationMessage);
  }

  @override
  Future<void> saveAnswer({
    required String attemptId,
    required ExamQuestion question,
    required String value,
  }) {
    throw const ExamOperationException(_configurationMessage);
  }

  @override
  Future<void> submitExam(String attemptId) {
    throw const ExamOperationException(_configurationMessage);
  }

  @override
  Future<void> recordIntegrityEvent({
    required String attemptId,
    required String examId,
    required String eventType,
  }) {
    throw const ExamOperationException(_configurationMessage);
  }

  @override
  Future<void> signOut() async {}
}
