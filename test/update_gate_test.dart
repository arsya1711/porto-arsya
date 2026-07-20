import 'package:awexam/app.dart';
import 'package:awexam/state/app_controller.dart';
import 'package:awexam/ui/update_required_screen.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/fake_exam_repository.dart';

void main() {
  group('AppController version gate', () {
    test('blocks a client older than the server requirement', () async {
      final controller = AppController(
        FakeExamRepository(minimumVersion: '1.2.0'),
        currentVersion: '1.1.0',
      );
      addTearDown(controller.dispose);

      await controller.initialize();

      expect(controller.updateRequired, isTrue);
      expect(controller.minimumVersion, '1.2.0');
      // Sesi tidak boleh dipulihkan di balik layar pemblokir.
      expect(controller.isLoggedIn, isFalse);
    });

    test('allows a client that meets the requirement', () async {
      final controller = AppController(
        FakeExamRepository(minimumVersion: '1.2.0'),
        currentVersion: '1.2.0',
      );
      addTearDown(controller.dispose);

      await controller.initialize();

      expect(controller.updateRequired, isFalse);
    });

    test('fails open when the requirement cannot be fetched', () async {
      final controller = AppController(
        FakeExamRepository(failVersionCheck: true),
        currentVersion: '1.0.0',
      );
      addTearDown(controller.dispose);

      await controller.initialize();

      expect(controller.updateRequired, isFalse);
    });

    test('skips the gate when the running version is unknown', () async {
      final controller = AppController(
        FakeExamRepository(minimumVersion: '9.9.9'),
      );
      addTearDown(controller.dispose);

      await controller.initialize();

      expect(controller.updateRequired, isFalse);
    });
  });

  testWidgets('shows the update screen instead of the login screen', (
    tester,
  ) async {
    await tester.pumpWidget(
      AWExamApp(
        repository: FakeExamRepository(minimumVersion: '2.0.0'),
        currentVersion: '1.0.0',
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(UpdateRequiredScreen), findsOneWidget);
    expect(find.text('Perbarui AWExam'), findsOneWidget);
    expect(find.text('1.0.0'), findsOneWidget);
    expect(find.text('2.0.0'), findsOneWidget);
    expect(find.text('Masuk ke aplikasi'), findsNothing);
  });
}
