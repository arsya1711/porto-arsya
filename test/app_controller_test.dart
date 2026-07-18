import 'package:flutter_test/flutter_test.dart';
import 'package:awexam/data/demo_repository.dart';
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
}
