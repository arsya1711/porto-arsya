import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/models.dart';
import 'exam_repository.dart';
import 'student_login_response.dart';

Exam parseExamCatalogEntry({
  required Map<String, dynamic> row,
  Map<String, dynamic>? attempt,
  DateTime? now,
}) {
  final schedule = DateTime.parse(row['starts_at'] as String).toLocal();
  final duration = (row['duration_minutes'] as num).toInt();
  final endsAt = row['ends_at'] == null
      ? schedule.add(Duration(minutes: duration))
      : DateTime.parse(row['ends_at'] as String).toLocal();

  return Exam(
    id: row['exam_id'] as String,
    title: row['title'] as String,
    subject: row['subject_name'] as String? ?? 'Mata pelajaran',
    subjectCode: row['subject_code'] as String? ?? '-',
    teacher: row['teacher_name'] as String? ?? 'Guru pengampu',
    schedule: schedule,
    durationMinutes: duration,
    questionCount: (row['question_count'] as num?)?.toInt() ?? 0,
    state: examStateFromCatalog(
      status: row['status'] as String,
      attemptStatus: attempt?['status'] as String?,
      startsAt: schedule,
      endsAt: endsAt,
      now: now,
    ),
    instructions: examInstructions(row['description'] as String?),
    score: (attempt?['final_score'] as num?)?.toDouble(),
    requiresCode: row['requires_access_code'] as bool? ?? false,
    lockdown: row['fullscreen_mode'] as bool? ?? true,
    recordIntegrityEvents: row['record_tab_switches'] as bool? ?? true,
  );
}

ExamState examStateFromCatalog({
  required String status,
  required String? attemptStatus,
  required DateTime startsAt,
  required DateTime endsAt,
  DateTime? now,
}) {
  if (const {'submitted', 'grading', 'final'}.contains(attemptStatus)) {
    return ExamState.completed;
  }
  if (attemptStatus == 'in_progress') return ExamState.inProgress;
  final currentTime = now ?? DateTime.now();
  if (currentTime.isBefore(startsAt)) return ExamState.upcoming;
  if (status == 'selesai' || currentTime.isAfter(endsAt)) {
    return ExamState.expired;
  }
  return ExamState.available;
}

List<String> examInstructions(String? description) {
  if (description == null || description.trim().isEmpty) {
    return const ['Baca setiap soal dengan teliti sebelum menjawab.'];
  }
  return description
      .split('\n')
      .map((line) => line.trim())
      .where((line) => line.isNotEmpty)
      .toList(growable: false);
}

({List<ExamQuestion> questions, Map<String, String> savedAnswers})
parseExamQuestionRows(List<dynamic> questionRows) {
  final questions = <ExamQuestion>[];
  final savedAnswers = <String, String>{};
  for (final raw in questionRows) {
    final row = Map<String, dynamic>.from(raw as Map);
    final questionId = row['question_id'] as String;
    questions.add(
      ExamQuestion(
        id: questionId,
        type: row['kind'] == 'essay'
            ? QuestionType.essay
            : QuestionType.multipleChoice,
        body: row['body'] as String? ?? '',
        options: row['options'] is List
            ? (row['options'] as List)
                  .map((option) => option.toString())
                  .toList(growable: false)
            : const [],
      ),
    );
    final value = row['essay_text'] ?? row['selected_option'];
    if (value != null) savedAnswers[questionId] = value.toString();
  }
  return (questions: questions, savedAnswers: savedAnswers);
}

String safeExamOperationMessage(String serverMessage) {
  final message = serverMessage.trim();
  final lowerMessage = message.toLowerCase();
  const safeFragments = [
    'ujian tidak ditemukan',
    'ujian belum dapat dimulai',
    'waktu ujian sudah berakhir',
    'kode akses ujian tidak sesuai',
    'ujian ini sudah pernah dikumpulkan',
    'attempt tidak ditemukan',
    'attempt sudah dikumpulkan',
    'attempt tidak aktif',
    'soal tidak ditemukan',
    'pilihan jawaban tidak valid',
    'jawaban essay terlalu panjang',
  ];
  for (final fragment in safeFragments) {
    if (lowerMessage.contains(fragment)) return message;
  }
  return 'Permintaan ujian tidak dapat diproses oleh server.';
}

DateTime? parseServerTime(dynamic value) {
  if (value is! String) return null;
  return DateTime.tryParse(value)?.toLocal();
}

class SupabaseExamRepository implements ExamRepository {
  SupabaseExamRepository(this.client);

  final SupabaseClient client;
  StudentProfile _profile = const StudentProfile(
    name: 'Siswa',
    studentNumber: '-',
    className: '-',
    school: 'Sekolah',
  );
  List<Exam> _exams = const [];

  @override
  StudentProfile get profile => _profile;

  @override
  List<Exam> get exams => _exams;

  @override
  Future<bool> restoreSession() async {
    final userId = client.auth.currentUser?.id;
    if (userId == null) return false;
    try {
      final profile = await client
          .from('profiles')
          .select('full_name,student_number')
          .eq('id', userId)
          .eq('role', 'siswa')
          .eq('active', true)
          .single();
      final classMembership = await client
          .from('class_students')
          .select('classes(name)')
          .eq('student_id', userId)
          .maybeSingle();
      _profile = StudentProfile(
        name: profile['full_name'] as String? ?? 'Siswa',
        studentNumber: profile['student_number'] as String? ?? '-',
        className: _className(classMembership?['classes']),
        school: await _loadSchoolName(),
      );
      return true;
    } catch (_) {
      await signOut();
      return false;
    }
  }

  @override
  Future<void> authenticate(String studentNumber, String password) async {
    try {
      final response = await client.functions.invoke(
        'student-login',
        body: {'student_number': studentNumber.trim(), 'password': password},
      );
      final loginResponse = parseStudentLoginResponse(
        response.data,
        fallbackStudentNumber: studentNumber.trim(),
      );

      await client.auth.setSession(loginResponse.refreshToken);
      if (client.auth.currentUser == null) {
        throw const AuthenticationException(
          'Sesi login tidak dapat dibuat. Silakan coba lagi.',
        );
      }
      _profile = StudentProfile(
        name: loginResponse.fullName,
        studentNumber: loginResponse.studentNumber,
        className: loginResponse.className,
        school: await _loadSchoolName(),
      );
    } on FunctionException catch (error) {
      final serverMessage = functionErrorMessage(error.details);
      if (serverMessage != null) {
        throw AuthenticationException(serverMessage);
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
    } on AuthenticationException {
      rethrow;
    } catch (_) {
      throw const AuthenticationException(
        'Respons layanan login tidak valid. Silakan coba lagi.',
      );
    }
  }

  @override
  Future<String?> minimumSupportedVersion() async {
    try {
      // Lewat RPC, bukan select tabel: pemeriksaan berjalan sebelum siswa login
      // sedangkan RLS school_profile_settings hanya melayani `authenticated`.
      final version = await client.rpc('get_minimum_app_version');
      if (version is String && version.trim().isNotEmpty) {
        return version.trim();
      }
    } catch (_) {
      // RPC belum terpasang atau server tidak terjangkau: jangan blokir siswa.
    }
    return null;
  }

  Future<String> _loadSchoolName() async {
    try {
      final row = await client
          .from('school_profile_settings')
          .select('school_name')
          .eq('id', 1)
          .maybeSingle();
      final schoolName = row?['school_name'] as String?;
      if (schoolName != null && schoolName.trim().isNotEmpty) {
        return schoolName.trim();
      }
    } catch (_) {
      // Nama sekolah tidak boleh menggagalkan login siswa.
    }
    return 'Sekolah';
  }

  String _className(dynamic relation) {
    if (relation is Map) return relation['name'] as String? ?? '-';
    if (relation is List && relation.isNotEmpty && relation.first is Map) {
      return (relation.first as Map)['name'] as String? ?? '-';
    }
    return '-';
  }

  @override
  Future<void> refreshExams() async {
    final userId = client.auth.currentUser?.id;
    if (userId == null) {
      _exams = const [];
      return;
    }

    final results = await Future.wait([
      client.rpc('get_student_exam_catalog'),
      client
          .from('attempts')
          .select('exam_id,status,final_score')
          .eq('student_id', userId),
    ]);
    final serverNow = await _loadServerTime() ?? DateTime.now();

    final attempts = <String, Map<String, dynamic>>{
      for (final row in results[1] as List)
        if ((row as Map)['exam_id'] != null)
          row['exam_id'] as String: Map<String, dynamic>.from(row),
    };

    _exams = (results[0] as List)
        .map((raw) {
          final row = Map<String, dynamic>.from(raw as Map);
          final examId = row['exam_id'] as String;
          return parseExamCatalogEntry(
            row: row,
            attempt: attempts[examId],
            now: serverNow,
          );
        })
        .toList(growable: false);
  }

  @override
  Future<ExamSession> startExam(String examId, {String? accessCode}) async {
    try {
      final startRows = await client.rpc(
        'start_exam_attempt',
        params: {
          'requested_exam_id': examId,
          'provided_access_code': accessCode?.trim().isEmpty ?? true
              ? null
              : accessCode!.trim(),
        },
      );
      final startRow = _firstRow(startRows);
      if (startRow == null) {
        final requiresCode = _exams.any(
          (exam) => exam.id == examId && exam.requiresCode,
        );
        if (requiresCode) {
          throw const ExamOperationException(
            'Kode akses ujian salah atau batas percobaan telah tercapai. Periksa kode dari pengawas.',
          );
        }
        throw const ExamOperationException(
          'Server tidak dapat memulai sesi ujian.',
        );
      }

      final attemptId = startRow['attempt_id'] as String?;
      final startedAtValue = startRow['started_at'] as String?;
      final deadlineValue = startRow['deadline'] as String?;
      if (attemptId == null ||
          startedAtValue == null ||
          deadlineValue == null) {
        throw const ExamOperationException('Data sesi ujian tidak lengkap.');
      }
      final startedAt = DateTime.parse(startedAtValue).toLocal();
      final deadline = DateTime.parse(deadlineValue).toLocal();
      final serverNow = await _loadServerTime() ?? DateTime.now();

      // Attempt lama dapat tetap berstatus in_progress ketika aplikasi ditutup
      // sampai melewati deadline. Finalisasikan jawaban yang sudah diterima
      // server agar kartu ujian tidak terjebak sebagai "sedang dikerjakan".
      if (!deadline.isAfter(serverNow)) {
        await submitExam(attemptId);
        try {
          await refreshExams();
        } catch (_) {
          // Finalisasi sudah berhasil; refresh katalog dapat dicoba dari beranda.
        }
        throw const ExamOperationException(
          'Waktu ujian sudah berakhir. Jawaban yang tersimpan di server telah dikumpulkan.',
        );
      }

      final questionRows = await client.rpc(
        'get_exam_questions',
        params: {'requested_exam_id': examId},
      );
      final parsedQuestions = parseExamQuestionRows(questionRows as List);
      final questions = parsedQuestions.questions;

      if (questions.isEmpty) {
        throw const ExamOperationException(
          'Soal ujian belum tersedia atau waktu ujian sudah berakhir.',
        );
      }

      return ExamSession(
        attemptId: attemptId,
        startedAt: startedAt,
        serverNow: serverNow,
        deadline: deadline,
        questions: questions,
        savedAnswers: parsedQuestions.savedAnswers,
      );
    } on ExamOperationException {
      rethrow;
    } on PostgrestException catch (error) {
      throw ExamOperationException(safeExamOperationMessage(error.message));
    } catch (_) {
      throw const ExamOperationException(
        'Tidak dapat memulai ujian. Periksa koneksi lalu coba lagi.',
      );
    }
  }

  Future<DateTime?> _loadServerTime() async {
    try {
      return parseServerTime(await client.rpc('get_server_time'));
    } catch (_) {
      // Kompatibel selama migration waktu server belum dipasang. Backend tetap
      // menjadi sumber kebenaran untuk deadline dan penolakan jawaban.
      return null;
    }
  }

  @override
  Future<void> saveAnswer({
    required String attemptId,
    required ExamQuestion question,
    required String value,
  }) async {
    final trimmedValue = value.trim();
    final selectedOption = question.type == QuestionType.multipleChoice
        ? int.tryParse(trimmedValue)
        : null;
    if (question.type == QuestionType.multipleChoice &&
        selectedOption == null) {
      throw const ExamOperationException('Pilihan jawaban tidak valid.');
    }

    try {
      await client.rpc(
        'save_exam_answer',
        params: {
          'target_attempt_id': attemptId,
          'target_question_id': question.id,
          'target_selected_option': selectedOption,
          'target_essay_text': question.type == QuestionType.essay
              ? value
              : null,
        },
      );
    } on PostgrestException catch (error) {
      throw ExamOperationException(safeExamOperationMessage(error.message));
    } catch (_) {
      throw const ExamOperationException(
        'Jawaban belum tersimpan. Periksa koneksi internet.',
      );
    }
  }

  @override
  Future<void> submitExam(String attemptId) async {
    try {
      await client.rpc(
        'submit_exam_attempt',
        params: {'target_attempt_id': attemptId},
      );
    } on PostgrestException catch (error) {
      throw ExamOperationException(safeExamOperationMessage(error.message));
    } catch (_) {
      throw const ExamOperationException(
        'Ujian belum dapat dikumpulkan. Periksa koneksi lalu coba lagi.',
      );
    }
  }

  @override
  Future<void> recordIntegrityEvent({
    required String attemptId,
    required String examId,
    required String eventType,
  }) async {
    try {
      await client.from('integrity_events').insert({
        'attempt_id': attemptId,
        'student_id': client.auth.currentUser?.id,
        'event_type': eventType,
        'metadata': {'exam_id': examId, 'platform': 'flutter'},
      });
    } catch (_) {
      throw const ExamOperationException(
        'Aktivitas integritas belum dapat dicatat.',
      );
    }
  }

  Map<String, dynamic>? _firstRow(dynamic value) {
    if (value is List && value.isNotEmpty && value.first is Map) {
      return Map<String, dynamic>.from(value.first as Map);
    }
    if (value is Map) return Map<String, dynamic>.from(value);
    return null;
  }

  @override
  Future<void> signOut() async {
    _profile = const StudentProfile(
      name: 'Siswa',
      studentNumber: '-',
      className: '-',
      school: 'Sekolah',
    );
    _exams = const [];
    await client.auth.signOut();
  }
}
