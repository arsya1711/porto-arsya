-- Kunci jawaban opsional saat soal masuk bank, wajib saat soal dipakai ujian.
--
-- Latar belakang: naskah ujian yang diimpor (PDF, Word, foto/OCR) umumnya tidak
-- memuat kunci jawaban, sehingga mewajibkan kunci sejak impor memaksa guru
-- mengetik ulang seluruh soal.
--
-- Namun penilaian otomatis membandingkan
-- `answer.selected_option = question.correct_option`. Ketika `correct_option`
-- bernilai NULL, perbandingan menghasilkan NULL dan jatuh ke cabang `else 0` —
-- setiap siswa dinilai SALAH pada soal itu apa pun jawabannya, tanpa peringatan
-- apa pun. Karena itu pemeriksaan dipindahkan ke titik soal dirangkai menjadi
-- ujian, bukan dihapus.
--
-- Trigger dipilih daripada menambahkan pemeriksaan ke dalam save_managed_exam
-- agar seluruh jalur penulisan exam_questions ikut terlindungi.

create or replace function public.require_answer_key_on_exam_question()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  question_type public.question_type;
  question_key integer;
begin
  select question.type, question.correct_option
  into question_type, question_key
  from public.questions question
  where question.id = new.question_id;

  if question_type is null then
    raise exception 'Soal tidak ditemukan';
  end if;

  if question_type = 'multiple_choice' and question_key is null then
    raise exception 'Soal pilihan ganda belum memiliki kunci jawaban. Lengkapi kunci pada bank soal sebelum memakainya dalam ujian.'
      using errcode = 'check_violation';
  end if;

  return new;
end
$$;

comment on function public.require_answer_key_on_exam_question() is
  'Menolak soal pilihan ganda tanpa kunci jawaban saat dirangkai ke dalam ujian; tanpa kunci, penilaian otomatis menilai semua jawaban siswa salah.';

drop trigger if exists exam_questions_require_answer_key on public.exam_questions;
create trigger exam_questions_require_answer_key
  before insert or update of question_id on public.exam_questions
  for each row
  execute function public.require_answer_key_on_exam_question();

-- Membantu guru menemukan soal yang perlu dilengkapi sebelum menyusun ujian.
create index if not exists questions_missing_answer_key_idx
  on public.questions(bank_id)
  where type = 'multiple_choice' and correct_option is null and not archived;
