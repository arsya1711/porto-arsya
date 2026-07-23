import 'package:awexam/data/attempt_draft_store.dart';
import 'package:awexam/data/demo_repository.dart';
import 'package:awexam/state/app_controller.dart';
import 'package:fake_async/fake_async.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/fake_exam_repository.dart';

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

    test('finalizes an expired attempt without sending late answers', () async {
      final repository = FakeExamRepository(expiredSession: true);
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
    test('keeps unsynced answers when the attempt is resumed', () async {
      final store = InMemoryAttemptDraftStore();
      final offline = FakeExamRepository(failSaves: true);
      final controller = AppController(offline, draftStore: store);

      await controller.startExam(offline.exams.single);
      controller.answer('question-1', '2');
      controller.toggleFlag('question-1');
      await Future<void>.delayed(Duration.zero);
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
      await Future<void>.delayed(Duration.zero);
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
