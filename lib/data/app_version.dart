/// Membandingkan dua versi semantik seperti `1.2.3`.
///
/// Mengembalikan nilai negatif bila [a] lebih lama dari [b], nol bila setara,
/// dan positif bila lebih baru. Ruas yang hilang dianggap nol, sehingga `1.2`
/// setara dengan `1.2.0`. Suffix build (`1.2.3+4`) diabaikan karena versi
/// minimum ditentukan per rilis, bukan per nomor build.
int compareAppVersions(String a, String b) {
  final left = _parse(a);
  final right = _parse(b);
  if (left == null || right == null) return 0;

  for (var i = 0; i < 3; i++) {
    final difference = left[i] - right[i];
    if (difference != 0) return difference < 0 ? -1 : 1;
  }
  return 0;
}

/// Menentukan apakah aplikasi terlalu lama untuk dipakai.
///
/// Sengaja gagal terbuka: konfigurasi kosong atau tidak valid tidak boleh
/// mengunci siswa dari ujian yang sedang berlangsung. Memblokir siswa yang
/// sebenarnya baik-baik saja jauh lebih merugikan daripada membiarkan klien
/// yang agak tertinggal tetap berjalan.
bool isUpdateRequired({
  required String currentVersion,
  required String? minimumVersion,
}) {
  if (minimumVersion == null || minimumVersion.trim().isEmpty) return false;
  if (_parse(currentVersion) == null || _parse(minimumVersion) == null) {
    return false;
  }
  return compareAppVersions(currentVersion, minimumVersion) < 0;
}

List<int>? _parse(String version) {
  final trimmed = version.trim().split('+').first.trim();
  if (trimmed.isEmpty) return null;

  final parts = trimmed.split('.');
  if (parts.length > 3) return null;

  final numbers = <int>[0, 0, 0];
  for (var i = 0; i < parts.length; i++) {
    final value = int.tryParse(parts[i]);
    if (value == null || value < 0) return null;
    numbers[i] = value;
  }
  return numbers;
}
