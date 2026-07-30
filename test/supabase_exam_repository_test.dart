import 'package:awexam/data/supabase_exam_repository.dart';
import 'package:awexam/models/models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final now = DateTime.parse('2026-07-29T08:00:00Z');

  Map<String, dynamic> catalogRow({
    String startsAt = '2026-07-29T07:30:00Z',
    String? endsAt = '2026-07-29T09:00:00Z',
    String status = 'berlangsung',
  }) => {
    'exam_id': 'exam-1',
    'title': 'Ujian Matematika',
    'subject_name': 'Matematika',
    'subject_code': 'MTK',
    'teacher_name': 'Guru Uji',
    'starts_at': startsAt,
    'ends_at': endsAt,
    'duration_minutes': 90,
    'question_count': 2,
    'status': status,
    'description': 'Baca soal\n\nKerjakan mandiri',
    'requires_access_code': true,
    'fullscreen_mode': false,
    'record_tab_switches': false,
  };

  group('parsing katalog Supabase', () {
    test('maps production flags, instructions, and active state', () {
      final exam = parseExamCatalogEntry(row: catalogRow(), now: now);

      expect(exam.id, 'exam-1');
      expect(exam.state, ExamState.available);
      expect(exam.instructions, ['Baca soal', 'Kerjakan mandiri']);
      expect(exam.requiresCode, isTrue);
      expect(exam.lockdown, isFalse);
      expect(exam.recordIntegrityEvents, isFalse);
    });

    test('prefers attempt state and score over schedule state', () {
      final exam = parseExamCatalogEntry(
        row: catalogRow(startsAt: '2026-08-01T08:00:00Z'),
        attempt: {'status': 'final', 'final_score': 87.5},
        now: now,
      );

      expect(exam.state, ExamState.completed);
      expect(exam.score, 87.5);
    });

    test('uses duration when the server omits ends_at', () {
      final exam = parseExamCatalogEntry(
        row: catalogRow(startsAt: '2026-07-29T08:30:00Z', endsAt: null),
        now: now,
      );

      expect(exam.state, ExamState.upcoming);
      expect(
        exam.schedule.add(Duration(minutes: exam.durationMinutes)),
        DateTime.parse('2026-07-29T10:00:00Z').toLocal(),
      );
    });
  });

  test('parses questions and previously saved answers', () {
    final parsed = parseExamQuestionRows([
      {
        'question_id': 'q-1',
        'kind': 'multiple_choice',
        'body': 'Pilih satu',
        'options': ['A', 'B'],
        'selected_option': 1,
        'essay_text': null,
      },
      {
        'question_id': 'q-2',
        'kind': 'essay',
        'body': 'Jelaskan',
        'options': null,
        'selected_option': null,
        'essay_text': 'Jawaban siswa',
      },
    ]);

    expect(parsed.questions, hasLength(2));
    expect(parsed.questions.first.options, ['A', 'B']);
    expect(parsed.questions.last.type, QuestionType.essay);
    expect(parsed.savedAnswers, {'q-1': '1', 'q-2': 'Jawaban siswa'});
  });

  test('does not expose unknown database errors to students', () {
    expect(
      safeExamOperationMessage('duplicate key violates constraint users_pkey'),
      'Permintaan ujian tidak dapat diproses oleh server.',
    );
    expect(
      safeExamOperationMessage('Waktu ujian sudah berakhir.'),
      'Waktu ujian sudah berakhir.',
    );
  });

  test('parses server time without trusting malformed values', () {
    expect(
      parseServerTime('2026-07-29T08:00:00Z'),
      DateTime.parse('2026-07-29T08:00:00Z').toLocal(),
    );
    expect(parseServerTime('waktu-rusak'), isNull);
    expect(parseServerTime(123), isNull);
  });
}
