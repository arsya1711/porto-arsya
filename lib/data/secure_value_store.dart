import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Kontrak kecil agar penyimpanan sensitif dapat diuji tanpa MethodChannel.
abstract interface class SecureValueStore {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> delete(String key);
}

class FlutterSecureValueStore implements SecureValueStore {
  const FlutterSecureValueStore.standard()
    : _storage = const FlutterSecureStorage();

  const FlutterSecureValueStore.session()
    : _storage = const FlutterSecureStorage(
        iOptions: IOSOptions(
          accessibility: KeychainAccessibility.first_unlock_this_device,
        ),
      );

  const FlutterSecureValueStore.withStorage(this._storage);

  final FlutterSecureStorage _storage;

  @override
  Future<String?> read(String key) => _storage.read(key: key);

  @override
  Future<void> write(String key, String value) =>
      _storage.write(key: key, value: value);

  @override
  Future<void> delete(String key) => _storage.delete(key: key);
}
