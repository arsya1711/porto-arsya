import 'dart:convert';

import 'package:awexam/data/attempt_draft_store.dart';
import 'package:awexam/data/secure_session_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support/fake_secure_value_store.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('SecureSessionStorage', () {
    test('persists, reads, and removes the Supabase session', () async {
      final secure = FakeSecureValueStore();
      final storage = SecureSessionStorage(storage: secure);

      expect(await storage.hasAccessToken(), isFalse);
      await storage.persistSession('refresh-token-json');

      expect(await storage.hasAccessToken(), isTrue);
      expect(await storage.accessToken(), 'refresh-token-json');

      await storage.removePersistedSession();
      expect(await storage.accessToken(), isNull);
    });

    test('fails safely when the device keystore cannot be read', () async {
      final secure = FakeSecureValueStore()
        ..values['awexam.supabase.session'] = 'stale'
        ..failReads = true;
      final storage = SecureSessionStorage(storage: secure);

      expect(await storage.accessToken(), isNull);
      expect(secure.values, isEmpty);
    });
  });

  group('SecureAttemptDraftStore', () {
    test('round-trips and clears an encrypted draft', () async {
      final secure = FakeSecureValueStore();
      final store = SecureAttemptDraftStore(storage: secure);
      const draft = AttemptDraft(
        attemptId: 'attempt-1',
        answers: {'question-1': '2'},
        unsyncedQuestionIds: {'question-1'},
        flagged: {'question-1'},
      );

      await store.save(draft);
      final restored = await store.load('attempt-1');

      expect(restored?.answers, {'question-1': '2'});
      expect(restored?.unsyncedQuestionIds, {'question-1'});
      expect(restored?.flagged, {'question-1'});
      expect(await store.load('attempt-other'), isNull);

      await store.clear();
      expect(await store.load('attempt-1'), isNull);
    });

    test('migrates the legacy plaintext draft then removes it', () async {
      const legacy = AttemptDraft(
        attemptId: 'attempt-legacy',
        answers: {'question-1': 'jawaban'},
        unsyncedQuestionIds: {'question-1'},
        flagged: {},
      );
      SharedPreferences.setMockInitialValues({
        'awexam.attempt_draft': jsonEncode(legacy.toJson()),
      });
      final secure = FakeSecureValueStore();
      final store = SecureAttemptDraftStore(storage: secure);

      final restored = await store.load('attempt-legacy');
      final prefs = await SharedPreferences.getInstance();

      expect(restored?.answers['question-1'], 'jawaban');
      expect(secure.values['awexam.attempt_draft'], isNotNull);
      expect(prefs.containsKey('awexam.attempt_draft'), isFalse);
    });

    test('deletes malformed encrypted data', () async {
      final secure = FakeSecureValueStore()
        ..values['awexam.attempt_draft'] = '{invalid';
      final store = SecureAttemptDraftStore(storage: secure);

      expect(await store.load('attempt-1'), isNull);
      expect(secure.values, isEmpty);
    });
  });
}
