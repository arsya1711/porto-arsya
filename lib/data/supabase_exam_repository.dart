import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/models.dart';
import 'demo_repository.dart';
import 'exam_repository.dart';

class SupabaseExamRepository implements ExamRepository {
  SupabaseExamRepository(this.client);

  final SupabaseClient client;
  final DemoRepository _catalogFallback = DemoRepository();
  StudentProfile? _profile;
  List<Exam> _exams = const [];

  @override
  StudentProfile get profile => _profile ?? _catalogFallback.profile;

  @override
  List<Exam> get exams => _exams;

  @override
  List<ExamQuestion> get questions => _catalogFallback.questions;

  @override
  Future<void> authenticate(String studentNumber, String password) async {
    try {
      final response = await client.functions.invoke(
        'student-login',
        body: {'student_number': studentNumber.trim(), 'password': password},
      );
      final data = Map<String, dynamic>.from(response.data as Map);
      final session = Map<String, dynamic>.from(data['session'] as Map);
      final profile = Map<String, dynamic>.from(data['profile'] as Map);
      final refreshToken = session['refresh_token'] as String?;

      if (refreshToken == null || refreshToken.isEmpty) {
        throw const AuthenticationException('Sesi login tidak valid.');
      }

      await client.auth.setSession(refreshToken);
      _profile = StudentProfile(
        name: profile['full_name'] as String? ?? 'Siswa',
        studentNumber: profile['student_number'] as String? ?? studentNumber,
        className: profile['class_name'] as String? ?? '-',
        school: 'Alhidayah Wattaqwa',
      );
      await refreshExams();
    } on FunctionException catch (error) {
      final details = error.details;
      if (details is Map && details['error'] is String) {
        throw AuthenticationException(details['error'] as String);
      }
      if (error.status == 401) {
        throw const AuthenticationException('NIS atau kata sandi salah.');
      }
      throw const AuthenticationException(
        'Layanan login sedang bermasalah. Silakan coba lagi.',
      );
    } on AuthException {
      throw const AuthenticationException(
        'Sesi login tidak dapat dibuat. Silakan coba lagi.',
      );
    }
  }

  @override
  Future<void> refreshExams() async {
    final userId = client.auth.currentUser?.id;
    if (userId == null) {
      _exams = const [];
      return;
    }

    final results = await Future.wait([
      client
          .from('exams')
          .select(
            'id,title,description,starts_at,ends_at,duration_minutes,status,'
            'access_code,fullscreen_mode,subjects(name,code),'
            'exam_questions(count)',
          )
          .neq('status', 'draft')
          .order('starts_at'),
      client
          .from('attempts')
          .select('exam_id,status,final_score')
          .eq('student_id', userId),
    ]);

    final attempts = <String, Map<String, dynamic>>{
      for (final row in results[1] as List)
        if ((row as Map)['exam_id'] != null)
          row['exam_id'] as String: Map<String, dynamic>.from(row),
    };

    _exams = (results[0] as List)
        .map((raw) {
          final row = Map<String, dynamic>.from(raw as Map);
          final subject = _relation(row['subjects']);
          final attempt = attempts[row['id']];
          final schedule = DateTime.parse(row['starts_at'] as String).toLocal();
          final duration = row['duration_minutes'] as int;
          final endsAt = row['ends_at'] == null
              ? schedule.add(Duration(minutes: duration))
              : DateTime.parse(row['ends_at'] as String).toLocal();

          return Exam(
            id: row['id'] as String,
            title: row['title'] as String,
            subject: subject?['name'] as String? ?? 'Mata pelajaran',
            subjectCode: subject?['code'] as String? ?? '-',
            teacher: 'Guru pengampu',
            schedule: schedule,
            durationMinutes: duration,
            questionCount: _relationCount(row['exam_questions']),
            state: _examState(
              status: row['status'] as String,
              attemptStatus: attempt?['status'] as String?,
              startsAt: schedule,
              endsAt: endsAt,
            ),
            instructions: _instructions(row['description'] as String?),
            score: (attempt?['final_score'] as num?)?.toDouble(),
            requiresCode: (row['access_code'] as String?)?.isNotEmpty ?? false,
            lockdown: row['fullscreen_mode'] as bool? ?? true,
          );
        })
        .toList(growable: false);
  }

  Map<String, dynamic>? _relation(dynamic value) {
    if (value is Map) return Map<String, dynamic>.from(value);
    if (value is List && value.isNotEmpty && value.first is Map) {
      return Map<String, dynamic>.from(value.first as Map);
    }
    return null;
  }

  int _relationCount(dynamic value) {
    final relation = _relation(value);
    return (relation?['count'] as num?)?.toInt() ?? 0;
  }

  List<String> _instructions(String? description) {
    if (description == null || description.trim().isEmpty) {
      return const ['Baca setiap soal dengan teliti sebelum menjawab.'];
    }
    return description
        .split('\n')
        .map((line) => line.trim())
        .where((line) => line.isNotEmpty)
        .toList(growable: false);
  }

  ExamState _examState({
    required String status,
    required String? attemptStatus,
    required DateTime startsAt,
    required DateTime endsAt,
  }) {
    if (const {'submitted', 'grading', 'final'}.contains(attemptStatus) ||
        status == 'selesai') {
      return ExamState.completed;
    }
    if (attemptStatus == 'in_progress') return ExamState.inProgress;
    final now = DateTime.now();
    if (now.isBefore(startsAt)) return ExamState.upcoming;
    if (now.isAfter(endsAt)) return ExamState.completed;
    return ExamState.available;
  }

  @override
  Future<void> signOut() async {
    _profile = null;
    _exams = const [];
    await client.auth.signOut();
  }
}
