import '../models/models.dart';

abstract interface class ExamRepository {
  StudentProfile get profile;
  List<Exam> get exams;
  List<ExamQuestion> get questions;

  Future<void> authenticate(String studentNumber, String password);
  Future<void> refreshExams();
  Future<void> signOut();
}

class AuthenticationException implements Exception {
  const AuthenticationException(this.message);

  final String message;

  @override
  String toString() => message;
}
