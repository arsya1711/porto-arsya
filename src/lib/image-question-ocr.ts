import type { PdfQuestionParseResult } from "./pdf-question-parser";
import { parsePdfQuestions } from "./pdf-question-parser";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_IMAGE_COUNT = 5;
const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export type ImageOcrProgress = {
  current: number;
  total: number;
  progress: number;
  status: string;
};

export type ImageOcrResult = {
  text: string;
  parsed: PdfQuestionParseResult;
};

type ImageFile = Pick<File, "name" | "size" | "type">;

export function validateImageFiles(files: ImageFile[]): string[] {
  if (!files.length) return ["Pilih minimal satu foto soal."];
  if (files.length > MAX_IMAGE_COUNT) {
    return [`Maksimal ${MAX_IMAGE_COUNT} foto dalam satu proses OCR.`];
  }

  const errors: string[] = [];
  for (const file of files) {
    if (!SUPPORTED_IMAGE_TYPES.has(file.type.toLowerCase())) {
      errors.push(`${file.name}: format harus JPG, PNG, atau WebP.`);
    }
    if (file.size > MAX_IMAGE_SIZE) {
      errors.push(`${file.name}: ukuran melebihi 10 MB.`);
    }
  }
  return errors;
}

/**
 * Merapikan pola yang umum muncul dari OCR. Nomor seperti "1." di awal baris
 * diubah menjadi penanda SOAL agar dapat diproses oleh parser impor yang sama.
 * Teks mentah tetap ditampilkan di UI sehingga guru dapat mengoreksi hasil OCR.
 */
export function normalizeOcrQuestionText(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[|¦]\s*(?=\d{1,3}\s*[.)-])/g, "")
    .replace(
      /^(?!\s*SOAL\b)\s*(\d{1,3})\s*[.)-]\s+(.+)$/gim,
      (_match, number: string, question: string) =>
        `SOAL ${number}\nPERTANYAAN: ${question.trim()}`,
    )
    .replace(/^\s*([A-F])\1\s*[.)-]\s*/gim, "$1. ")
    .replace(/^\s*([A-F])\s*[,;:]\s+/gim, "$1. ")
    .replace(/^\s*KUNC[Il1]\s*[:.-]\s*/gim, "KUNCI: ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function humanizeStatus(status: string) {
  const labels: Record<string, string> = {
    "loading tesseract core": "Menyiapkan mesin OCR",
    "initializing tesseract": "Menginisialisasi OCR",
    "loading language traineddata": "Memuat bahasa Indonesia",
    "initializing api": "Menyiapkan pengenal teks",
    "recognizing text": "Membaca teks pada foto",
  };
  return labels[status] ?? "Memproses foto";
}

export async function extractImageQuestions(
  files: File[],
  onProgress?: (progress: ImageOcrProgress) => void,
): Promise<ImageOcrResult> {
  const validationErrors = validateImageFiles(files);
  if (validationErrors.length) throw new Error(validationErrors.join(" "));

  const { createWorker, OEM, PSM } = await import("tesseract.js");
  let activeFile = 0;
  const report = (progress: number, status: string) => {
    onProgress?.({
      current: Math.min(activeFile + 1, files.length),
      total: files.length,
      progress: Math.max(0, Math.min(1, progress)),
      status,
    });
  };

  report(0, "Menyiapkan mesin OCR");
  const worker = await createWorker("ind", OEM.LSTM_ONLY, {
    logger: (message) => {
      const initializationWeight = activeFile === 0 && message.status !== "recognizing text" ? 0.08 : 0;
      const fileProgress = message.status === "recognizing text" ? message.progress : initializationWeight * message.progress;
      report(
        (activeFile + fileProgress) / files.length,
        humanizeStatus(message.status),
      );
    },
  });

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
      preserve_interword_spaces: "1",
      user_defined_dpi: "300",
    });

    const pages: string[] = [];
    for (const [index, file] of files.entries()) {
      activeFile = index;
      report(index / files.length, `Membaca foto ${index + 1} dari ${files.length}`);
      const result = await worker.recognize(file);
      const clean = result.data.text.trim();
      if (clean) pages.push(clean);
    }

    if (!pages.length) {
      throw new Error(
        "Teks tidak terdeteksi. Gunakan foto yang terang, tajam, dan diambil lurus dari atas.",
      );
    }

    const text = normalizeOcrQuestionText(pages.join("\n\n"));
    report(1, "OCR selesai");
    return { text, parsed: parsePdfQuestions(text) };
  } finally {
    await worker.terminate();
  }
}
