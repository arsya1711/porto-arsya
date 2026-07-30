import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'app.dart';
import 'data/attempt_draft_store.dart';
import 'data/demo_repository.dart';
import 'data/exam_repository.dart';
import 'data/secure_session_storage.dart';
import 'data/supabase_exam_repository.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Konfigurasi hanya masuk melalui dart-define pada waktu kompilasi. Jangan
  // pernah menaruh service_role atau secret server lain di aplikasi klien.
  const compiledSupabaseUrl = String.fromEnvironment('SUPABASE_URL');
  const compiledSupabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');
  const allowDemo = bool.fromEnvironment('ALLOW_DEMO');
  late final ExamRepository repository;

  if (compiledSupabaseUrl.isNotEmpty && compiledSupabaseAnonKey.isNotEmpty) {
    await Supabase.initialize(
      url: compiledSupabaseUrl,
      publishableKey: compiledSupabaseAnonKey,
      authOptions: const FlutterAuthClientOptions(
        localStorage: SecureSessionStorage(),
      ),
    );
    repository = SupabaseExamRepository(Supabase.instance.client);
  } else if (!kReleaseMode || allowDemo) {
    repository = DemoRepository();
  } else {
    repository = const UnavailableExamRepository();
  }

  // Dibaca dari paket terpasang, bukan konstanta terpisah, agar tidak melenceng
  // dari `version:` di pubspec.yaml.
  final packageInfo = await PackageInfo.fromPlatform();

  runApp(
    AWExamApp(
      repository: repository,
      draftStore: const SecureAttemptDraftStore(),
      currentVersion: packageInfo.version,
    ),
  );
}
