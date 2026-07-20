import 'package:awexam/models/models.dart';
import 'package:awexam/state/app_controller.dart';
import 'package:awexam/theme/app_theme.dart';
import 'package:awexam/ui/exam_room_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/fake_exam_repository.dart';

const _twoQuestions = [
  ExamQuestion(
    id: 'question-1',
    type: QuestionType.multipleChoice,
    body: 'Ibu kota Indonesia?',
    options: ['Bandung', 'Jakarta', 'Surabaya'],
  ),
  ExamQuestion(
    id: 'question-2',
    type: QuestionType.essay,
    body: 'Jelaskan alasanmu.',
  ),
];

/// Menjalankan sebuah test di dalam ruang ujian dengan attempt yang sudah aktif.
///
/// Countdown ujian memakai [Timer.periodic] yang hidup berjam-jam, sedangkan
/// widget test menolak timer yang masih tertunda. Pembersihan harus terjadi di
/// dalam body test — `addTearDown` berjalan setelah pemeriksaan itu — sehingga
/// pohon widget dilepas dan controller dibuang di blok `finally`.
void examRoomTest(
  String description,
  Future<void> Function(
    WidgetTester tester,
    AppController controller,
    FakeExamRepository repository,
  )
  body, {
  FakeExamRepository Function()? repository,
}) {
  testWidgets(description, (tester) async {
    final repo =
        repository?.call() ?? FakeExamRepository(questions: _twoQuestions);
    final controller = AppController(repo);
    await controller.startExam(repo.exams.single);

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: ExamRoomScreen(controller: controller),
      ),
    );
    await tester.pumpAndSettle();

    try {
      await body(tester, controller, repo);
    } finally {
      await tester.pumpWidget(const SizedBox.shrink());
      controller.dispose();
    }
  });
}

void main() {
  examRoomTest('records the chosen option and reports it as synced', (
    tester,
    controller,
    repository,
  ) async {
    expect(find.text('Ibu kota Indonesia?'), findsOneWidget);
    expect(find.text('0/2 terjawab'), findsOneWidget);

    await tester.tap(find.text('Jakarta'));
    await tester.pumpAndSettle();

    // Indeks opsi, bukan teksnya, yang dikirim ke server.
    expect(controller.answers['question-1'], '1');
    expect(repository.savedAnswers['question-1'], '1');
    expect(find.text('1/2 terjawab'), findsOneWidget);
    expect(find.text('Tersinkron'), findsOneWidget);
  });

  examRoomTest(
    'shows pending answers while the server is unreachable',
    repository: () =>
        FakeExamRepository(questions: _twoQuestions, failSaves: true),
    (tester, controller, repository) async {
      await tester.tap(find.text('Jakarta'));
      await tester.pumpAndSettle();

      expect(find.text('1 tertunda'), findsOneWidget);
      expect(find.text('1 jawaban menunggu sinkronisasi'), findsOneWidget);
    },
  );

  examRoomTest('moves between questions and offers the review step last', (
    tester,
    controller,
    repository,
  ) async {
    expect(find.text('Soal 1 dari 2'), findsOneWidget);

    await tester.tap(find.text('Soal berikutnya'));
    await tester.pumpAndSettle();

    expect(find.text('Soal 2 dari 2'), findsOneWidget);
    expect(find.text('Jelaskan alasanmu.'), findsOneWidget);
    expect(find.text('Periksa jawaban'), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'Karena ibu kota pindah.');
    await tester.pumpAndSettle();

    expect(controller.answers['question-2'], 'Karena ibu kota pindah.');
  });

  examRoomTest('marks a question as doubtful', (
    tester,
    controller,
    repository,
  ) async {
    final flagButton = find.widgetWithText(TextButton, 'Tandai ragu');
    expect(flagButton, findsOneWidget);

    await tester.ensureVisible(flagButton);
    await tester.tap(flagButton);
    await tester.pumpAndSettle();

    expect(controller.flagged, contains('question-1'));
    expect(find.text('Ditandai'), findsOneWidget);
  });

  examRoomTest('submits from the review sheet and shows the summary', (
    tester,
    controller,
    repository,
  ) async {
    await tester.tap(find.text('Jakarta'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Soal berikutnya'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Periksa jawaban'));
    await tester.pumpAndSettle();

    expect(find.text('Kumpulkan ujian'), findsOneWidget);
    await tester.tap(find.text('Kumpulkan ujian'));
    await tester.pumpAndSettle();

    // Pengumpulan selalu melewati dialog konfirmasi.
    expect(find.text('Kumpulkan ujian sekarang?'), findsOneWidget);
    await tester.tap(find.text('Ya, kumpulkan'));
    await tester.pumpAndSettle();

    expect(repository.submittedAttemptId, 'attempt-1');
    expect(controller.submissionCompleted, isTrue);
    expect(find.text('Ujian berhasil dikirim!'), findsOneWidget);
  });

  examRoomTest(
    'keeps the student in the room when submitting fails',
    repository: () =>
        FakeExamRepository(questions: _twoQuestions, failSubmits: true),
    (tester, controller, repository) async {
      await tester.tap(find.text('Soal berikutnya'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Periksa jawaban'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Kumpulkan ujian'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Ya, kumpulkan'));
      await tester.pumpAndSettle();

      expect(controller.submissionCompleted, isFalse);
      expect(find.text('Ujian berhasil dikirim!'), findsNothing);
      expect(find.text('Soal 2 dari 2'), findsOneWidget);
      expect(find.byType(SnackBar), findsOneWidget);
    },
  );

  examRoomTest(
    'records an integrity event when the app returns to foreground',
    (tester, controller, repository) async {
      expect(controller.integrityEvents, 0);

      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      await tester.pump();
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pumpAndSettle();

      expect(controller.integrityEvents, 1);
      expect(repository.integrityEventTypes, ['app_backgrounded']);
      expect(
        find.text('Aktivitas keluar aplikasi telah dicatat.'),
        findsOneWidget,
      );
    },
  );
}
