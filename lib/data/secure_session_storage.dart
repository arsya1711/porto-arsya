import 'package:supabase_flutter/supabase_flutter.dart';

import 'secure_value_store.dart';

/// Menyimpan sesi Supabase di penyimpanan aman Android alih-alih
/// SharedPreferences biasa.
///
/// Default bawaan `supabase_flutter` menulis refresh token sebagai teks polos di
/// penyimpanan aplikasi, sehingga token siswa dapat terbaca pada perangkat yang
/// di-root atau dari hasil backup.
class SecureSessionStorage extends LocalStorage {
  const SecureSessionStorage({SecureValueStore? storage})
    : _storage = storage ?? const FlutterSecureValueStore.session();

  static const _sessionKey = 'awexam.supabase.session';

  final SecureValueStore _storage;

  @override
  Future<void> initialize() async {}

  @override
  Future<bool> hasAccessToken() async => await _read() != null;

  @override
  Future<String?> accessToken() => _read();

  @override
  Future<void> persistSession(String persistSessionString) async {
    try {
      await _storage.write(_sessionKey, persistSessionString);
    } catch (_) {
      // Sesi tetap hidup di memori; siswa hanya perlu login ulang lain kali.
    }
  }

  @override
  Future<void> removePersistedSession() async {
    try {
      await _storage.delete(_sessionKey);
    } catch (_) {
      // Diabaikan; signOut tidak boleh gagal karena masalah penyimpanan.
    }
  }

  /// Keystore yang rusak atau tidak tersedia diperlakukan sebagai "tidak ada
  /// sesi" supaya aplikasi jatuh ke layar login, bukan crash saat dibuka.
  Future<String?> _read() async {
    try {
      return await _storage.read(_sessionKey);
    } catch (_) {
      await removePersistedSession();
      return null;
    }
  }
}
