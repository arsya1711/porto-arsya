import 'package:awexam/data/student_login_response.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('parseStudentLoginResponse', () {
    const response = {
      'session': {'refresh_token': 'refresh-token'},
      'profile': {
        'full_name': 'Siswa Uji',
        'student_number': '12345',
        'class_name': 'IX A',
      },
    };

    test('membaca objek JSON dari Edge Function', () {
      final result = parseStudentLoginResponse(
        response,
        fallbackStudentNumber: 'fallback',
      );

      expect(result.refreshToken, 'refresh-token');
      expect(result.fullName, 'Siswa Uji');
      expect(result.studentNumber, '12345');
      expect(result.className, 'IX A');
    });

    test('membaca JSON string dan mengisi profil opsional', () {
      final result = parseStudentLoginResponse(
        '{"session":{"refresh_token":"token"},"profile":{}}',
        fallbackStudentNumber: '54321',
      );

      expect(result.refreshToken, 'token');
      expect(result.fullName, 'Siswa');
      expect(result.studentNumber, '54321');
      expect(result.className, '-');
    });

    test('menolak response tanpa session yang lengkap', () {
      expect(
        () => parseStudentLoginResponse(const {
          'profile': <String, Object?>{},
        }, fallbackStudentNumber: '12345'),
        throwsFormatException,
      );
    });
  });

  group('functionErrorMessage', () {
    test('membaca error dari map maupun JSON string', () {
      expect(
        functionErrorMessage(const {'error': 'NIS atau kata sandi salah.'}),
        'NIS atau kata sandi salah.',
      );
      expect(
        functionErrorMessage('{"error":"Terlalu banyak percobaan login."}'),
        'Terlalu banyak percobaan login.',
      );
    });

    test('mengabaikan detail yang bukan error JSON', () {
      expect(functionErrorMessage('<html>error</html>'), isNull);
      expect(functionErrorMessage(const {'message': 'error'}), isNull);
    });
  });
}
