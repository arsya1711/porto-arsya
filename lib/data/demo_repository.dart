import '../models/models.dart';
import 'exam_repository.dart';

class DemoRepository implements ExamRepository {
  @override
  final profile = const StudentProfile(
    name: 'Alya Putri',
    studentNumber: '24001',
    className: 'IX A',
    school: 'Alhidayah Wattaqwa',
  );

  @override
  late final List<Exam> exams = [
    Exam(
      id: 'exam-1',
      title: 'Penilaian Akhir Semester',
      subject: 'Matematika',
      subjectCode: 'MTK',
      teacher: 'Ibu Rina Kusuma, S.Pd.',
      schedule: DateTime(2026, 7, 13, 9),
      durationMinutes: 90,
      questionCount: 5,
      state: ExamState.available,
      requiresCode: true,
      instructions: const [
        'Pastikan perangkat memiliki daya yang cukup dan koneksi stabil saat memulai.',
        'Kerjakan setiap soal dengan teliti. Jawaban tersimpan otomatis selama sesi demo.',
        'Keluar dari aplikasi selama ujian akan dicatat sebagai aktivitas integritas.',
        'Periksa kembali jawaban sebelum menekan tombol kumpulkan.',
      ],
    ),
    Exam(
      id: 'exam-2',
      title: 'Ulangan Bab Ekosistem',
      subject: 'Ilmu Pengetahuan Alam',
      subjectCode: 'IPA',
      teacher: 'Bapak Dimas Pratama, S.Pd.',
      schedule: DateTime(2026, 7, 14, 11),
      durationMinutes: 60,
      questionCount: 25,
      state: ExamState.upcoming,
      instructions: const [
        'Baca seluruh pertanyaan sebelum memilih jawaban.',
        'Tidak diperkenankan menggunakan buku catatan.',
      ],
    ),
    Exam(
      id: 'exam-3',
      title: 'Asesmen Teks Eksplanasi',
      subject: 'Bahasa Indonesia',
      subjectCode: 'BIN',
      teacher: 'Ibu Maya Lestari, S.Pd.',
      schedule: DateTime(2026, 7, 15, 8),
      durationMinutes: 75,
      questionCount: 30,
      state: ExamState.upcoming,
      instructions: const [
        'Jawablah dengan bahasa Indonesia yang baik dan benar.',
      ],
    ),
    Exam(
      id: 'exam-4',
      title: 'Kuis Sejarah Indonesia',
      subject: 'Ilmu Pengetahuan Sosial',
      subjectCode: 'IPS',
      teacher: 'Bapak Arif Wibowo, S.Pd.',
      schedule: DateTime(2026, 7, 8, 10),
      durationMinutes: 45,
      questionCount: 20,
      state: ExamState.completed,
      score: 88,
      instructions: const [],
    ),
  ];

  final List<ExamQuestion> questions = const [
    ExamQuestion(
      id: 'q1',
      type: QuestionType.multipleChoice,
      body: 'Hasil dari 3(2x − 4) + 5 jika x = 3 adalah …',
      options: ['5', '7', '9', '11'],
    ),
    ExamQuestion(
      id: 'q2',
      type: QuestionType.multipleChoice,
      body: 'Bentuk sederhana dari 4a + 3b − 2a + 5b adalah …',
      options: ['2a + 2b', '2a + 8b', '6a + 2b', '6a + 8b'],
    ),
    ExamQuestion(
      id: 'q3',
      type: QuestionType.multipleChoice,
      body:
          'Jika keliling persegi adalah 48 cm, luas persegi tersebut adalah …',
      options: ['64 cm²', '100 cm²', '121 cm²', '144 cm²'],
    ),
    ExamQuestion(
      id: 'q4',
      type: QuestionType.multipleChoice,
      body: 'Nilai dari √144 + √81 adalah …',
      options: ['19', '20', '21', '22'],
    ),
    ExamQuestion(
      id: 'q5',
      type: QuestionType.essay,
      body:
          'Tuliskan langkah penyelesaian dari persamaan 2x + 5 = 17 dan jelaskan alasan pada setiap langkah.',
    ),
  ];

  @override
  Future<bool> restoreSession() async => false;

  @override
  Future<void> authenticate(String username, String password) async {
    await Future<void>.delayed(const Duration(milliseconds: 650));
    if (username != '24001' || password != 'siswa123') {
      throw const AuthenticationException('NIS atau kata sandi salah.');
    }
  }

  @override
  Future<String?> minimumSupportedVersion() async => null;

  @override
  Future<void> refreshExams() async {}

  @override
  Future<ExamSession> startExam(String examId, {String? accessCode}) async {
    Exam? exam;
    for (final item in exams) {
      if (item.id == examId) {
        exam = item;
        break;
      }
    }
    if (exam == null) {
      throw const ExamOperationException('Ujian tidak ditemukan.');
    }
    if (exam.requiresCode && accessCode?.trim().toUpperCase() != 'UJIAN') {
      throw const ExamOperationException('Kode akses ujian tidak sesuai.');
    }
    final startedAt = DateTime.now();
    return ExamSession(
      attemptId: 'demo-$examId',
      startedAt: startedAt,
      deadline: startedAt.add(Duration(minutes: exam.durationMinutes)),
      questions: questions,
    );
  }

  @override
  Future<void> saveAnswer({
    required String attemptId,
    required ExamQuestion question,
    required String value,
  }) async {}

  @override
  Future<void> submitExam(String attemptId) async {}

  @override
  Future<void> recordIntegrityEvent({
    required String attemptId,
    required String examId,
    required String eventType,
  }) async {}

  @override
  Future<void> signOut() async {}
}
