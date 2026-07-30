import 'package:awexam/data/secure_value_store.dart';

class FakeSecureValueStore implements SecureValueStore {
  final Map<String, String> values = {};
  bool failReads = false;
  bool failWrites = false;
  bool failDeletes = false;
  int writes = 0;
  int deletes = 0;

  @override
  Future<String?> read(String key) async {
    if (failReads) throw Exception('read failed');
    return values[key];
  }

  @override
  Future<void> write(String key, String value) async {
    if (failWrites) throw Exception('write failed');
    writes++;
    values[key] = value;
  }

  @override
  Future<void> delete(String key) async {
    if (failDeletes) throw Exception('delete failed');
    deletes++;
    values.remove(key);
  }
}
