import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Menyimpan sesi Supabase di Keychain (iOS) dan EncryptedSharedPreferences
/// (Android) alih-alih SharedPreferences biasa.
///
/// Default bawaan `supabase_flutter` menulis refresh token sebagai teks polos di
/// penyimpanan aplikasi, sehingga token siswa dapat terbaca pada perangkat yang
/// di-root atau dari hasil backup.
class SecureSessionStorage extends LocalStorage {
  const SecureSessionStorage({FlutterSecureStorage? storage})
    : _storage =
          storage ??
          const FlutterSecureStorage(
            // Android v10 memakai cipher terenkripsi secara default.
            iOptions: IOSOptions(
              accessibility: KeychainAccessibility.first_unlock_this_device,
            ),
          );

  static const _sessionKey = 'awexam.supabase.session';

  final FlutterSecureStorage _storage;

  @override
  Future<void> initialize() async {}

  @override
  Future<bool> hasAccessToken() async => await _read() != null;

  @override
  Future<String?> accessToken() => _read();

  @override
  Future<void> persistSession(String persistSessionString) async {
    try {
      await _storage.write(key: _sessionKey, value: persistSessionString);
    } catch (_) {
      // Sesi tetap hidup di memori; siswa hanya perlu login ulang lain kali.
    }
  }

  @override
  Future<void> removePersistedSession() async {
    try {
      await _storage.delete(key: _sessionKey);
    } catch (_) {
      // Diabaikan; signOut tidak boleh gagal karena masalah penyimpanan.
    }
  }

  /// Keystore yang rusak atau tidak tersedia diperlakukan sebagai "tidak ada
  /// sesi" supaya aplikasi jatuh ke layar login, bukan crash saat dibuka.
  Future<String?> _read() async {
    try {
      return await _storage.read(key: _sessionKey);
    } catch (_) {
      await removePersistedSession();
      return null;
    }
  }
}
