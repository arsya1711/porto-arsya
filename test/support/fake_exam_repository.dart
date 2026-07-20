import 'package:awexam/data/exam_repository.dart';
import 'package:awexam/models/models.dart';

/// Repository ujian palsu yang merekam panggilan; dipakai unit test controller
/// maupun widget test ruang ujian.
class FakeExamRepository implements ExamRepository {
  FakeExamRepository({
    this.failSaves = false,
    this.delayedValue,
    this.expiredSession = false,
    this.failSubmits = false,
    this.attemptId = 'attempt-1',
    this.startedAt,
    this.savedServerAnswers = const {},
    this.questions = defaultQuestions,
    this.minimumVersion,
    this.failVersionCheck = false,
  });

  static const defaultQuestions = [
    ExamQuestion(
      id: 'question-1',
      type: QuestionType.multipleChoice,
      body: 'Pilih jawaban.',
      options: ['A', 'B', 'C'],
    ),
  ];

  final bool failSaves;
  final String? delayedValue;
  final bool expiredSession;
  final bool failSubmits;
  final String attemptId;
  final DateTime? startedAt;
  final Map<String, String> savedServerAnswers;
  final List<ExamQuestion> questions;
  final String? minimumVersion;
  final bool failVersionCheck;

  final Map<String, String> savedAnswers = {};
  final List<String> integrityEventTypes = [];
  String? submittedAttemptId;
  int saveCalls = 0;

  @override
  StudentProfile get profile => const StudentProfile(
    name: 'Siswa Uji',
    studentNumber: '1001',
    className: 'IX A',
    school: 'AWExam',
  );

  @override
  List<Exam> get exams => [
    Exam(
      id: 'exam-1',
      title: 'Ujian Uji',
      subject: 'Matematika',
      subjectCode: 'MTK',
      teacher: 'Guru',
      schedule: DateTime.now(),
      durationMinutes: 60,
      questionCount: questions.length,
      state: ExamState.available,
      instructions: const [],
    ),
  ];

  @override
  Future<bool> restoreSession() async => false;

  @override
  Future<void> authenticate(String studentNumber, String password) async {}

  @override
  Future<void> refreshExams() async {}

  @override
  Future<String?> minimumSupportedVersion() async {
    if (failVersionCheck) throw Exception('server tidak terjangkau');
    return minimumVersion;
  }

  @override
  Future<ExamSession> startExam(String examId, {String? accessCode}) async {
    final now = startedAt ?? DateTime.now();
    return ExamSession(
      attemptId: attemptId,
      startedAt: now,
      deadline: expiredSession
          ? now.subtract(const Duration(seconds: 1))
          : now.add(const Duration(hours: 1)),
      questions: questions,
      savedAnswers: savedServerAnswers,
    );
  }

  @override
  Future<void> saveAnswer({
    required String attemptId,
    required ExamQuestion question,
    required String value,
  }) async {
    saveCalls++;
    if (failSaves) {
      throw const ExamOperationException('Jawaban belum tersimpan.');
    }
    if (value == delayedValue) {
      await Future<void>.delayed(const Duration(milliseconds: 20));
    }
    savedAnswers[question.id] = value;
  }

  @override
  Future<void> submitExam(String attemptId) async {
    if (failSubmits) {
      throw const ExamOperationException('Server tidak dapat dihubungi.');
    }
    submittedAttemptId = attemptId;
  }

  @override
  Future<void> recordIntegrityEvent({
    required String attemptId,
    required String examId,
    required String eventType,
  }) async {
    integrityEventTypes.add(eventType);
  }

  @override
  Future<void> signOut() async {}
}
