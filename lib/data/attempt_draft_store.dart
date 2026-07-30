import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'secure_value_store.dart';

/// Salinan lokal dari pengerjaan satu attempt.
///
/// Draft menjaga jawaban yang belum diterima server tetap ada ketika aplikasi
/// ditutup paksa atau kehilangan koneksi di tengah ujian.
class AttemptDraft {
  const AttemptDraft({
    required this.attemptId,
    required this.answers,
    required this.unsyncedQuestionIds,
    required this.flagged,
  });

  final String attemptId;
  final Map<String, String> answers;
  final Set<String> unsyncedQuestionIds;
  final Set<String> flagged;

  Map<String, dynamic> toJson() => {
    'attempt_id': attemptId,
    'answers': answers,
    'unsynced': unsyncedQuestionIds.toList(growable: false),
    'flagged': flagged.toList(growable: false),
  };

  static AttemptDraft? fromJson(Map<String, dynamic> json) {
    final attemptId = json['attempt_id'];
    if (attemptId is! String || attemptId.isEmpty) return null;
    return AttemptDraft(
      attemptId: attemptId,
      answers: {
        if (json['answers'] is Map)
          for (final entry in (json['answers'] as Map).entries)
            if (entry.key is String && entry.value is String)
              entry.key as String: entry.value as String,
      },
      unsyncedQuestionIds: _stringSet(json['unsynced']),
      flagged: _stringSet(json['flagged']),
    );
  }

  static Set<String> _stringSet(dynamic value) => {
    if (value is List)
      for (final item in value)
        if (item is String) item,
  };
}

abstract interface class AttemptDraftStore {
  /// Mengembalikan draft hanya jika tersimpan untuk [attemptId] yang sama.
  Future<AttemptDraft?> load(String attemptId);
  Future<void> save(AttemptDraft draft);
  Future<void> clear();
}

/// Menyimpan satu draft aktif dalam penyimpanan terenkripsi.
///
/// Versi lama menaruh JSON di SharedPreferences. Saat pertama dibaca, draft itu
/// dipindahkan ke secure storage dan salinan plaintext langsung dihapus.
class SecureAttemptDraftStore implements AttemptDraftStore {
  const SecureAttemptDraftStore({SecureValueStore? storage})
    : _storage = storage ?? const FlutterSecureValueStore.standard();

  static const _key = 'awexam.attempt_draft';
  final SecureValueStore _storage;

  @override
  Future<AttemptDraft?> load(String attemptId) async {
    var raw = await _storage.read(_key);
    if (raw == null) {
      final prefs = await SharedPreferences.getInstance();
      raw = prefs.getString(_key);
      if (raw != null) {
        await _storage.write(_key, raw);
        await prefs.remove(_key);
      }
    }
    if (raw == null) return null;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map<String, dynamic>) return null;
      final draft = AttemptDraft.fromJson(decoded);
      return draft?.attemptId == attemptId ? draft : null;
    } on FormatException {
      await _storage.delete(_key);
      return null;
    }
  }

  @override
  Future<void> save(AttemptDraft draft) async {
    await _storage.write(_key, jsonEncode(draft.toJson()));
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key);
  }

  @override
  Future<void> clear() async {
    await _storage.delete(_key);
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key);
  }
}

/// Dipakai pada mode demo dan pengujian agar tidak menyentuh penyimpanan device.
class InMemoryAttemptDraftStore implements AttemptDraftStore {
  AttemptDraft? _draft;

  @override
  Future<AttemptDraft?> load(String attemptId) async =>
      _draft?.attemptId == attemptId ? _draft : null;

  @override
  Future<void> save(AttemptDraft draft) async => _draft = draft;

  @override
  Future<void> clear() async => _draft = null;
}
