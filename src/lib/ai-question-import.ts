import { supabase } from "./supabase";
import type {
  ParsedPdfQuestion,
  PdfQuestionParseResult,
} from "./pdf-question-parser";

type AiQuestion = {
  number?: unknown;
  type?: unknown;
  text?: unknown;
  options?: unknown;
};

// Selaras dengan batas di edge function `import-questions`; lihat catatan di
// sana untuk asal angkanya (batas konteks 8.192 token pada free tier Cerebras).
const MAX_SOURCE_CHARS = 6000;

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

/// Menerapkan aturan validasi yang sama dengan parser deterministik agar soal
/// bermasalah tidak ikut tercentang otomatis di layar preview.
function validate(question: ParsedPdfQuestion): string[] {
  const errors: string[] = [];
  if (question.text.length < 3) errors.push("Pertanyaan belum diisi.");
  if (question.text.length > 5000) {
    errors.push("Pertanyaan melebihi 5.000 karakter.");
  }
  if (question.type === "Pilihan Ganda") {
    if (question.options.length < 2 || question.options.length > 6) {
      errors.push("Pilihan ganda harus memiliki 2 sampai 6 opsi.");
    }
    if (question.options.some((option) => !option)) {
      errors.push("Semua opsi pilihan ganda wajib diisi.");
    }
    // Kunci jawaban tidak diambil dari naskah dan boleh menyusul; soal tanpa
    // kunci ditolak saat dipakai menyusun ujian, bukan saat disimpan ke bank.
  }
  return errors;
}

function toParsedQuestion(raw: AiQuestion, index: number): ParsedPdfQuestion {
  const options = toStringArray(raw.options);
  const isEssay = raw.type === "essay" || (raw.type !== "pilihan_ganda" && !options.length);
  const question: ParsedPdfQuestion = {
    sourceNumber: typeof raw.number === "number" ? raw.number : index + 1,
    type: isEssay ? "Essay" : "Pilihan Ganda",
    text: typeof raw.text === "string" ? raw.text.trim() : "",
    difficulty: "Sedang",
    options: isEssay ? [] : options,
    // Kunci sengaja kosong: naskah ujian tidak memuatnya, dan tebakan model
    // yang salah akan membuat siswa dinilai keliru. Guru mengisinya di preview.
    correctOption: null,
    answerKey: "",
    weight: 1,
    errors: [],
  };
  question.errors = validate(question);
  return question;
}

/// Mengekstrak soal dari teks naskah lewat edge function `import-questions`.
///
/// Teks harus sudah diekstrak di klien (pdfjs, mammoth, atau OCR) — free tier
/// Cerebras hanya melayani model teks.
export async function extractQuestionsWithAi(
  text: string,
): Promise<PdfQuestionParseResult> {
  if (!supabase) {
    return {
      questions: [],
      errors: ["Impor AI membutuhkan koneksi Supabase."],
    };
  }
  const source = text.trim();
  if (!source) {
    return { questions: [], errors: ["Teks soal masih kosong."] };
  }
  if (source.length > MAX_SOURCE_CHARS) {
    return {
      questions: [],
      errors: [
        `Naskah terlalu panjang (${source.length} karakter, maksimal ${MAX_SOURCE_CHARS}). Impor per bagian, misalnya pilihan ganda dulu lalu essay.`,
      ],
    };
  }

  const { data, error } = await supabase.functions.invoke("import-questions", {
    body: { text: source },
  });

  if (error) {
    const detail = (error as { context?: { error?: unknown } }).context?.error;
    return {
      questions: [],
      errors: [
        typeof detail === "string"
          ? detail
          : "Impor AI gagal. Periksa koneksi lalu coba lagi.",
      ],
    };
  }

  const rawQuestions = (data as { questions?: unknown } | null)?.questions;
  if (!Array.isArray(rawQuestions) || !rawQuestions.length) {
    return {
      questions: [],
      errors: ["AI tidak menemukan soal pada naskah ini."],
    };
  }

  const questions = rawQuestions.map((raw, index) =>
    toParsedQuestion(raw as AiQuestion, index),
  );

  const needingKey = questions.filter(
    (question) =>
      question.type === "Pilihan Ganda" && question.correctOption === null,
  ).length;
  const errors = needingKey
    ? [
        `${needingKey} soal belum punya kunci jawaban. Soal tetap dapat disimpan ke bank, tetapi kunci wajib diisi sebelum soal dipakai menyusun ujian.`,
      ]
    : [];
  return { questions, errors };
}
