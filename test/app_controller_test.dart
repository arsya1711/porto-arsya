import 'package:awexam/data/attempt_draft_store.dart';
import 'package:awexam/data/demo_repository.dart';
import 'package:awexam/models/models.dart';
import 'package:awexam/state/app_controller.dart';
import 'package:fake_async/fake_async.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/fake_exam_repository.dart';

class _DelayedDraftStore implements AttemptDraftStore {
  final List<AttemptDraft> writes = [];
  int activeWrites = 0;
  int maxConcurrentWrites = 0;

  @override
  Future<AttemptDraft?> load(String attemptId) async => null;

  @override
  Future<void> save(AttemptDraft draft) async {
    activeWrites++;
    maxConcurrentWrites = activeWrites > maxConcurrentWrites
        ? activeWrites
        : maxConcurrentWrites;
    try {
      await Future<void>.delayed(const Duration(milliseconds: 15));
      writes.add(draft);
    } finally {
      activeWrites--;
    }
  }

  @override
  Future<void> clear() async {}
}

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

    test('keeps a valid login when the first catalog refresh fails', () async {
      final controller = AppController(FakeExamRepository(failRefresh: true));
      addTearDown(controller.dispose);

      expect(await controller.login('12345', 'password'), isTrue);
      expect(controller.isLoggedIn, isTrue);
      expect(controller.isOnline, isFalse);
      expect(
        controller.operationError,
        'Login berhasil, tetapi jadwal ujian belum dapat dimuat. Coba muat ulang.',
      );
    });

    test('keeps a restored session when catalog refresh is offline', () async {
      final controller = AppController(
        FakeExamRepository(restoreSessionResult: true, failRefresh: true),
      );
      addTearDown(controller.dispose);

      await controller.initialize();

      expect(controller.isLoggedIn, isTrue);
      expect(controller.isOnline, isFalse);
      expect(controller.operationError, contains('Sesi dipulihkan'));
    });
  });

  group('AppController exam flow', () {
    test(
      'loads server session, saves answers, and submits the attempt',
      () async {
        final repository = FakeExamRepository();
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
      final repository = FakeExamRepository(failSaves: true);
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
      final repository = FakeExamRepository(delayedValue: '0');
      final controller = AppController(repository);
      addTearDown(controller.dispose);

      await controller.startExam(repository.exams.single);
      controller.answer('question-1', '0');
      controller.answer('question-1', '2');
      await Future<void>.delayed(const Duration(milliseconds: 40));

      expect(repository.savedAnswers['question-1'], '2');
      expect(controller.unsyncedCount, 0);
    });

    test('never redirects a queued save into a newer attempt', () async {
      final repository = FakeExamRepository(delayedValue: '0');
      final controller = AppController(repository);
      addTearDown(controller.dispose);

      await controller.startExam(repository.exams.single);
      controller.answer('question-1', '0');
      controller.answer('question-1', '2');

      repository.attemptId = 'attempt-2';
      await controller.startExam(repository.exams.single);
      await Future<void>.delayed(const Duration(milliseconds: 50));

      final staleSave = repository.saveHistory.singleWhere(
        (entry) => entry.value == '2',
      );
      expect(staleSave.attemptId, 'attempt-1');
    });

    test('retries an unsynced answer after the connection recovers', () async {
      final repository = FakeExamRepository(failSaves: true);
      final controller = AppController(repository);
      addTearDown(controller.dispose);

      await controller.startExam(repository.exams.single);
      controller.answer('question-1', '2');
      await Future<void>.delayed(Duration.zero);
      expect(controller.unsyncedCount, 1);

      repository.failSaves = false;
      await controller.retryUnsyncedAnswers();

      expect(repository.savedAnswers['question-1'], '2');
      expect(controller.unsyncedCount, 0);
      expect(controller.isOnline, isTrue);
      expect(controller.operationError, isNull);
    });

    test('limits retry bursts to four answer requests at once', () async {
      final questions = List.generate(
        12,
        (index) => ExamQuestion(
          id: 'question-$index',
          type: QuestionType.multipleChoice,
          body: 'Soal $index',
          options: const ['A', 'B'],
        ),
      );
      final repository = FakeExamRepository(
        questions: questions,
        failSaves: true,
        saveDelay: const Duration(milliseconds: 2),
      );
      final controller = AppController(repository);
      addTearDown(controller.dispose);

      await controller.startExam(repository.exams.single);
      for (final question in questions) {
        controller.answer(question.id, '1');
      }
      await Future<void>.delayed(const Duration(milliseconds: 30));
      expect(controller.unsyncedCount, questions.length);

      repository
        ..failSaves = false
        ..saveDelay = const Duration(milliseconds: 10)
        ..maxConcurrentSaves = 0;
      await controller.retryUnsyncedAnswers();

      expect(controller.unsyncedCount, 0);
      expect(repository.maxConcurrentSaves, lessThanOrEqualTo(4));
    });

    test('finalizes an expired attempt without answers', () async {
      final repository = FakeExamRepository(expiredSession: true);
      final controller = AppController(repository);
      addTearDown(controller.dispose);

      expect(await controller.startExam(repository.exams.single), isTrue);
      expect(controller.remainingSeconds, 0);

      expect(await controller.submitExam(), isTrue);
      expect(repository.saveCalls, 0);
      expect(repository.submittedAttemptId, 'attempt-1');
    });

    test('reports answers that could not sync when time expires', () async {
      final base = DateTime(2026, 1, 1, 8);
      var now = base;
      final repository = FakeExamRepository(startedAt: base, failSaves: true);
      final controller = AppController(repository, clock: () => now);
      addTearDown(controller.dispose);

      await controller.startExam(repository.exams.single);
      controller.answer('question-1', '1');
      await Future<void>.delayed(Duration.zero);

      now = base.add(const Duration(hours: 2));
      controller.syncRemainingSeconds();
      await Future<void>.delayed(Duration.zero);
      await Future<void>.delayed(Duration.zero);

      expect(repository.submittedAttemptId, 'attempt-1');
      expect(controller.submissionCompleted, isTrue);
      expect(controller.submissionWarning, contains('1 jawaban lokal'));
    });
  });

  group('AppController countdown', () {
    test('uses server time when the device clock is wrong', () async {
      final serverNow = DateTime(2026, 1, 1, 8);
      var deviceNow = serverNow.add(const Duration(hours: 5));
      final repository = FakeExamRepository(
        startedAt: serverNow,
        serverNow: serverNow,
      );
      final controller = AppController(repository, clock: () => deviceNow);
      addTearDown(controller.dispose);

      await controller.startExam(repository.exams.single);
      expect(controller.remainingSeconds, 3600);

      deviceNow = deviceNow.add(const Duration(minutes: 25));
      controller.syncRemainingSeconds();
      expect(controller.remainingSeconds, 2100);
    });

    test('does not submit during the final partial second', () async {
      final base = DateTime(2026, 1, 1, 8);
      var now = base;
      final repository = FakeExamRepository(startedAt: base);
      final controller = AppController(repository, clock: () => now);
      addTearDown(controller.dispose);

      await controller.startExam(repository.exams.single);
      now = base.add(const Duration(minutes: 59, seconds: 59, milliseconds: 1));
      controller.syncRemainingSeconds();

      expect(controller.remainingSeconds, 1);
      expect(repository.submittedAttemptId, isNull);
    });

    test('recomputes the countdown from the server deadline', () async {
      final base = DateTime(2026, 1, 1, 8);
      var now = base;
      final repository = FakeExamRepository(startedAt: base);
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
      final repository = FakeExamRepository(startedAt: base);
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
        final repository = FakeExamRepository(
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
    test('serializes draft writes so the newest snapshot wins', () async {
      final store = _DelayedDraftStore();
      final repository = FakeExamRepository();
      final controller = AppController(repository, draftStore: store);
      addTearDown(controller.dispose);

      await controller.startExam(repository.exams.single);
      controller.answer('question-1', '0');
      final first = controller.flushDraft();
      controller.answer('question-1', '2');
      final second = controller.flushDraft();
      await Future.wait([first, second]);

      expect(store.maxConcurrentWrites, 1);
      expect(store.writes.last.answers['question-1'], '2');
    });

    test('clears the active attempt draft on logout', () async {
      final store = InMemoryAttemptDraftStore();
      final repository = FakeExamRepository(failSaves: true);
      final controller = AppController(repository, draftStore: store);
      addTearDown(controller.dispose);

      await controller.startExam(repository.exams.single);
      controller.answer('question-1', '2');
      await controller.flushDraft();
      expect(await store.load('attempt-1'), isNotNull);

      await controller.logout();

      expect(await store.load('attempt-1'), isNull);
      expect(controller.isLoggedIn, isFalse);
      expect(controller.activeAttemptId, isNull);
    });

    test('keeps unsynced answers when the attempt is resumed', () async {
      final store = InMemoryAttemptDraftStore();
      final offline = FakeExamRepository(failSaves: true);
      final controller = AppController(offline, draftStore: store);

      await controller.startExam(offline.exams.single);
      controller.answer('question-1', '2');
      controller.toggleFlag('question-1');
      await controller.flushDraft();
      expect(controller.unsyncedCount, 1);
      // Aplikasi ditutup paksa sebelum jawaban sempat tersinkron.
      controller.dispose();

      final online = FakeExamRepository();
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
      final repository = FakeExamRepository(
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
      final first = FakeExamRepository(failSaves: true);
      final controller = AppController(first, draftStore: store);

      await controller.startExam(first.exams.single);
      controller.answer('question-1', '2');
      await controller.flushDraft();
      controller.dispose();

      final other = FakeExamRepository(attemptId: 'attempt-2');
      final resumed = AppController(other, draftStore: store);
      addTearDown(resumed.dispose);

      await resumed.startExam(other.exams.single);

      expect(resumed.answers, isEmpty);
      expect(resumed.unsyncedCount, 0);
    });
  });
}
