import 'package:flutter_test/flutter_test.dart';
import 'package:awexam/data/demo_repository.dart';
import 'package:awexam/data/exam_repository.dart';
import 'package:awexam/models/models.dart';
import 'package:awexam/state/app_controller.dart';

void main() {
  group('AppController login', () {
    test('accepts valid demo credentials', () async {
      final controller = AppController(DemoRepository());

      expect(await controller.login('24001', 'siswa123'), isTrue);
      expect(controller.isLoggedIn, isTrue);
      expect(controller.authenticationError, isNull);
    });

    test('rejects invalid credentials with a safe message', () async {
      final controller = AppController(DemoRepository());

      expect(await controller.login('24001', 'wrongpass'), isFalse);
      expect(controller.isLoggedIn, isFalse);
      expect(controller.authenticationError, 'NIS atau kata sandi salah.');
    });
  });

  group('AppController exam flow', () {
    test(
      'loads server session, saves answers, and submits the attempt',
      () async {
        final repository = _RecordingRepository();
        final controller = AppController(repository);
        addTearDown(controller.dispose);

        expect(
          await controller.startExam(
            repository.exams.single,
            accessCode: 'ABC',
          ),
          isTrue,
        );
        expect(controller.activeAttemptId, 'attempt-1');
        expect(controller.questions, hasLength(1));
        expect(controller.remainingSeconds, greaterThan(0));

        controller.answer('question-1', '2');
        await Future<void>.delayed(Duration.zero);
        expect(repository.savedAnswers['question-1'], '2');
        expect(controller.unsyncedCount, 0);

        expect(await controller.submitExam(), isTrue);
        expect(repository.submittedAttemptId, 'attempt-1');
        expect(controller.submissionCompleted, isTrue);
      },
    );

    test('does not submit while an answer cannot be synchronized', () async {
      final repository = _RecordingRepository(failSaves: true);
      final controller = AppController(repository);
      addTearDown(controller.dispose);

      await controller.startExam(repository.exams.single);
      controller.answer('question-1', '1');
      await Future<void>.delayed(Duration.zero);

      expect(await controller.submitExam(), isFalse);
      expect(repository.submittedAttemptId, isNull);
      expect(controller.submissionCompleted, isFalse);
      expect(controller.operationError, contains('belum tersimpan'));
    });

    test('serializes rapid changes so the latest answer wins', () async {
      final repository = _RecordingRepository(delayedValue: '0');
      final controller = AppController(repository);
      addTearDown(controller.dispose);

      await controller.startExam(repository.exams.single);
      controller.answer('question-1', '0');
      controller.answer('question-1', '2');
      await Future<void>.delayed(const Duration(milliseconds: 40));

      expect(repository.savedAnswers['question-1'], '2');
      expect(controller.unsyncedCount, 0);
    });

    test('finalizes an expired attempt without sending late answers', () async {
      final repository = _RecordingRepository(expiredSession: true);
      final controller = AppController(repository);
      addTearDown(controller.dispose);

      expect(await controller.startExam(repository.exams.single), isTrue);
      expect(controller.remainingSeconds, 0);

      expect(await controller.submitExam(), isTrue);
      expect(repository.saveCalls, 0);
      expect(repository.submittedAttemptId, 'attempt-1');
    });
  });
}

class _RecordingRepository implements ExamRepository {
  _RecordingRepository({
    this.failSaves = false,
    this.delayedValue,
    this.expiredSession = false,
  });

  final bool failSaves;
  final String? delayedValue;
  final bool expiredSession;
  final Map<String, String> savedAnswers = {};
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
      questionCount: 1,
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
  Future<ExamSession> startExam(String examId, {String? accessCode}) async {
    final now = DateTime.now();
    return ExamSession(
      attemptId: 'attempt-1',
      startedAt: now,
      deadline: expiredSession
          ? now.subtract(const Duration(seconds: 1))
          : now.add(const Duration(hours: 1)),
      questions: const [
        ExamQuestion(
          id: 'question-1',
          type: QuestionType.multipleChoice,
          body: 'Pilih jawaban.',
          options: ['A', 'B', 'C'],
        ),
      ],
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
    submittedAttemptId = attemptId;
  }

  @override
  Future<void> recordIntegrityEvent({
    required String attemptId,
    required String examId,
    required String eventType,
  }) async {}

  @override
  Future<void> signOut() async {}
}
