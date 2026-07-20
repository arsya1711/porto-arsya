import 'package:awexam/data/app_version.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('compareAppVersions', () {
    test('orders by each numeric segment', () {
      expect(compareAppVersions('1.0.0', '1.0.1'), isNegative);
      expect(compareAppVersions('1.1.0', '1.0.9'), isPositive);
      expect(compareAppVersions('2.0.0', '1.9.9'), isPositive);
      expect(compareAppVersions('1.2.3', '1.2.3'), isZero);
    });

    test('compares numerically rather than as text', () {
      // Perbandingan string biasa akan menganggap '10' lebih kecil dari '9'.
      expect(compareAppVersions('1.10.0', '1.9.0'), isPositive);
      expect(compareAppVersions('10.0.0', '9.0.0'), isPositive);
    });

    test('treats missing segments as zero and ignores build suffixes', () {
      expect(compareAppVersions('1.2', '1.2.0'), isZero);
      expect(compareAppVersions('1', '1.0.0'), isZero);
      expect(compareAppVersions('1.2.3+9', '1.2.3+1'), isZero);
    });
  });

  group('isUpdateRequired', () {
    test('blocks a client older than the minimum', () {
      expect(
        isUpdateRequired(currentVersion: '1.0.0', minimumVersion: '1.1.0'),
        isTrue,
      );
    });

    test('allows a client at or above the minimum', () {
      expect(
        isUpdateRequired(currentVersion: '1.1.0', minimumVersion: '1.1.0'),
        isFalse,
      );
      expect(
        isUpdateRequired(currentVersion: '2.0.0', minimumVersion: '1.1.0'),
        isFalse,
      );
    });

    // Mengunci siswa keluar dari ujian karena konfigurasi kacau jauh lebih
    // merugikan daripada membiarkan klien lama tetap jalan.
    test('fails open when the requirement is absent or malformed', () {
      for (final minimum in [null, '', '  ', 'terbaru', '1.2.3.4', '1.x.0']) {
        expect(
          isUpdateRequired(currentVersion: '1.0.0', minimumVersion: minimum),
          isFalse,
          reason: 'minimum "$minimum" seharusnya tidak memblokir',
        );
      }
    });

    test('fails open when the running version is unreadable', () {
      expect(
        isUpdateRequired(currentVersion: '', minimumVersion: '1.1.0'),
        isFalse,
      );
    });
  });
}
