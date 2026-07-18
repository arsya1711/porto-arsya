import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'app.dart';
import 'data/exam_repository.dart';
import 'data/supabase_exam_repository.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await dotenv.load(fileName: '.env');

  const definedSupabaseUrl = String.fromEnvironment('SUPABASE_URL');
  const definedSupabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');
  final supabaseUrl = definedSupabaseUrl.isNotEmpty
      ? definedSupabaseUrl
      : dotenv.env['SUPABASE_URL'] ?? '';
  final supabaseAnonKey = definedSupabaseAnonKey.isNotEmpty
      ? definedSupabaseAnonKey
      : dotenv.env['SUPABASE_ANON_KEY'] ?? '';
  ExamRepository? repository;

  if (supabaseUrl.isNotEmpty && supabaseAnonKey.isNotEmpty) {
    await Supabase.initialize(
      url: supabaseUrl,
      publishableKey: supabaseAnonKey,
    );
    repository = SupabaseExamRepository(Supabase.instance.client);
  }

  runApp(AWExamApp(repository: repository));
}
