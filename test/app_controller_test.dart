import 'package:fake_async/fake_async.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:awexam/data/attempt_draft_store.dart';
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

  group('AppController countdown', () {
    test('recomputes the countdown from the server deadline', () async {
      final base = DateTime(2026, 1, 1, 8);
      var now = base;
      final repository = _RecordingRepository(startedAt: base);
      final controller = AppController(repository, clock: () => now);
      addTearDown(controller.dispose);

      await controller.startExam(repository.exams.single);
      expect(controller.remainingSeconds, 3600);

      // Aplikasi disuspensi: timer periodik tidak berjalan, tetapi waktu dinding
      // tetap maju. Sisa waktu harus mengikuti deadline, bukan jumlah tick.
      now = base.add(const Duration(minutes: 25));
      controller.syncRemainingSeconds();

      expect(controller.remainingSeconds, 2100);
    });

    test('auto-submits when the deadline passes while suspended', () async {
      final base = DateTime(2026, 1, 1, 8);
      var now = base;
      final repository = _RecordingRepository(startedAt: base);
      final controller = AppController(repository, clock: () => now);
      addTearDown(controller.dispose);

      await controller.startExam(repository.exams.single);
      now = base.add(const Duration(hours: 2));
      controller.syncRemainingSeconds();
      await Future<void>.delayed(Duration.zero);

      expect(controller.remainingSeconds, 0);
      expect(repository.submittedAttemptId, 'attempt-1');
      expect(controller.submissionCompleted, isTrue);
    });

    test('stops retrying auto-submit and asks for a manual send', () async {
      fakeAsync((async) {
        final base = DateTime(2026, 1, 1, 8);
        var now = base;
        final repository = _RecordingRepository(
          startedAt: base,
          failSubmits: true,
        );
        final controller = AppController(repository, clock: () => now);

        controller.startExam(repository.exams.single);
        async.flushMicrotasks();
        now = base.add(const Duration(hours: 2));
        controller.syncRemainingSeconds();
        async.elapse(const Duration(minutes: 5));

        expect(controller.autoSubmitExhausted, isTrue);
        expect(controller.submissionCompleted, isFalse);
        expect(controller.operationError, contains('tombol kumpulkan'));
        controller.dispose();
      });
    });
  });

  group('AppController offline draft', () {
    test('keeps unsynced answers when the attempt is resumed', () async {
      final store = InMemoryAttemptDraftStore();
      final offline = _RecordingRepository(failSaves: true);
      final controller = AppController(offline, draftStore: store);

      await controller.startExam(offline.exams.single);
      controller.answer('question-1', '2');
      controller.toggleFlag('question-1');
      await Future<void>.delayed(Duration.zero);
      expect(controller.unsyncedCount, 1);
      // Aplikasi ditutup paksa sebelum jawaban sempat tersinkron.
      controller.dispose();

      final online = _RecordingRepository();
      final resumed = AppController(online, draftStore: store);
      addTearDown(resumed.dispose);

      await resumed.startExam(online.exams.single);
      await Future<void>.delayed(Duration.zero);

      expect(resumed.answers['question-1'], '2');
      expect(resumed.flagged, contains('question-1'));
      expect(online.savedAnswers['question-1'], '2');
      expect(resumed.unsyncedCount, 0);
    });

    test('prefers the server answer once the draft is synced', () async {
      final store = InMemoryAttemptDraftStore();
      final repository = _RecordingRepository(
        savedServerAnswers: const {'question-1': '1'},
      );
      final controller = AppController(repository, draftStore: store);
      addTearDown(controller.dispose);

      await controller.startExam(repository.exams.single);
      controller.answer('question-1', '2');
      await Future<void>.delayed(Duration.zero);
      expect(controller.unsyncedCount, 0);

      expect(await controller.submitExam(), isTrue);
      expect(await store.load('attempt-1'), isNull);
    });

    test('ignores a draft that belongs to another attempt', () async {
      final store = InMemoryAttemptDraftStore();
      final first = _RecordingRepository(failSaves: true);
      final controller = AppController(first, draftStore: store);

      await controller.startExam(first.exams.single);
      controller.answer('question-1', '2');
      await Future<void>.delayed(Duration.zero);
      controller.dispose();

      final other = _RecordingRepository(attemptId: 'attempt-2');
      final resumed = AppController(other, draftStore: store);
      addTearDown(resumed.dispose);

      await resumed.startExam(other.exams.single);

      expect(resumed.answers, isEmpty);
      expect(resumed.unsyncedCount, 0);
    });
  });
}

class _RecordingRepository implements ExamRepository {
  _RecordingRepository({
    this.failSaves = false,
    this.delayedValue,
    this.expiredSession = false,
    this.failSubmits = false,
    this.attemptId = 'attempt-1',
    this.startedAt,
    this.savedServerAnswers = const {},
  });

  final bool failSaves;
  final String? delayedValue;
  final bool expiredSession;
  final bool failSubmits;
  final String attemptId;
  final DateTime? startedAt;
  final Map<String, String> savedServerAnswers;
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
    final now = startedAt ?? DateTime.now();
    return ExamSession(
      attemptId: attemptId,
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
  }) async {}

  @override
  Future<void> signOut() async {}
}
