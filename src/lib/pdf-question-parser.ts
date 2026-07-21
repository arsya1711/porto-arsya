export type ImportedQuestionType = "Pilihan Ganda" | "Essay";
export type ImportedDifficulty = "Mudah" | "Sedang" | "Sulit";

export type ParsedPdfQuestion = {
  sourceNumber: number;
  type: ImportedQuestionType;
  text: string;
  difficulty: ImportedDifficulty;
  options: string[];
  correctOption: number | null;
  answerKey: string;
  weight: number;
  errors: string[];
};

export type PdfQuestionParseResult = {
  questions: ParsedPdfQuestion[];
  errors: string[];
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_PAGES = 100;
const MAX_QUESTIONS = 100;

function append(target: string[], value: string) {
  const clean = value.trim();
  if (clean) target.push(clean);
}

function normalizeDifficulty(value: string): ImportedDifficulty {
  const normalized = value.trim().toLowerCase();
  if (normalized === "mudah") return "Mudah";
  if (normalized === "sulit") return "Sulit";
  return "Sedang";
}

function parseBlock(sourceNumber: number, block: string): ParsedPdfQuestion {
  const questionParts: string[] = [];
  const answerParts: string[] = [];
  const optionParts = new Map<string, string[]>();
  const errors: string[] = [];
  let typeValue = "";
  let difficultyValue = "Sedang";
  let weightValue = "1";
  let keyValue = "";
  let active:
    | { kind: "question" | "answer" }
    | { kind: "option"; letter: string }
    | null = null;

  for (const rawLine of block.split("\n")) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (!line) continue;

    const typeMatch = line.match(/^TIPE\s*:\s*(.*)$/i);
    if (typeMatch) {
      typeValue = typeMatch[1].trim();
      active = null;
      continue;
    }
    const questionMatch = line.match(/^(?:PERTANYAAN|SOAL)\s*:\s*(.*)$/i);
    if (questionMatch) {
      append(questionParts, questionMatch[1]);
      active = { kind: "question" };
      continue;
    }
    const optionMatch = line.match(/^([A-F])\s*[.)-]\s*(.*)$/i);
    if (optionMatch) {
      const letter = optionMatch[1].toUpperCase();
      const values = optionParts.get(letter) ?? [];
      append(values, optionMatch[2]);
      optionParts.set(letter, values);
      active = { kind: "option", letter };
      continue;
    }
    const keyMatch = line.match(/^KUNCI\s*:\s*(.*)$/i);
    if (keyMatch) {
      keyValue = keyMatch[1].trim().toUpperCase();
      active = null;
      continue;
    }
    const answerMatch = line.match(/^(?:JAWABAN|PEDOMAN)\s*:\s*(.*)$/i);
    if (answerMatch) {
      append(answerParts, answerMatch[1]);
      active = { kind: "answer" };
      continue;
    }
    const difficultyMatch = line.match(/^KESULITAN\s*:\s*(.*)$/i);
    if (difficultyMatch) {
      difficultyValue = difficultyMatch[1].trim();
      active = null;
      continue;
    }
    const weightMatch = line.match(/^BOBOT\s*:\s*(.*)$/i);
    if (weightMatch) {
      weightValue = weightMatch[1].trim();
      active = null;
      continue;
    }

    if (active?.kind === "question") append(questionParts, line);
    else if (active?.kind === "answer") append(answerParts, line);
    else if (active?.kind === "option") {
      append(optionParts.get(active.letter) ?? [], line);
    } else {
      // Tetap menerima pertanyaan tanpa label PERTANYAAN agar PDF sederhana
      // masih dapat diproses, selama metadata lainnya mengikuti format.
      append(questionParts, line);
      active = { kind: "question" };
    }
  }

  const optionLetters = [...optionParts.keys()].sort();
  const options = optionLetters.map((letter) =>
    (optionParts.get(letter) ?? []).join(" ").trim(),
  );
  const normalizedType = typeValue.toLowerCase();
  const type: ImportedQuestionType =
    normalizedType.includes("essay") || normalizedType.includes("esai")
      ? "Essay"
      : normalizedType.includes("pg") ||
          normalizedType.includes("pilihan") ||
          options.length > 0
        ? "Pilihan Ganda"
        : "Essay";
  const text = questionParts.join(" ").trim();
  const answerKey = answerParts.join(" ").trim();
  const weight = Number(weightValue.replace(",", "."));
  const correctLetter = keyValue.match(/[A-F]/)?.[0] ?? "";
  const correctOption = correctLetter
    ? correctLetter.charCodeAt(0) - "A".charCodeAt(0)
    : null;

  if (text.length < 3) errors.push("Pertanyaan belum diisi.");
  if (text.length > 5000) errors.push("Pertanyaan melebihi 5.000 karakter.");
  if (!Number.isFinite(weight) || weight <= 0 || weight > 9999) {
    errors.push("Bobot harus berupa angka antara 0 dan 9.999.");
  }
  if (
    difficultyValue.trim() &&
    !["mudah", "sedang", "sulit"].includes(
      difficultyValue.trim().toLowerCase(),
    )
  ) {
    errors.push("Kesulitan harus Mudah, Sedang, atau Sulit.");
  }

  if (type === "Pilihan Ganda") {
    if (options.length < 2 || options.length > 6) {
      errors.push("Pilihan ganda harus memiliki 2 sampai 6 opsi.");
    }
    if (options.some((option) => !option)) {
      errors.push("Semua opsi pilihan ganda wajib diisi.");
    }
    const expectedLetters = options.map((_, index) =>
      String.fromCharCode(65 + index),
    );
    if (optionLetters.join("") !== expectedLetters.join("")) {
      errors.push("Urutan opsi harus berurutan mulai dari A.");
    }
    // Kunci boleh kosong: naskah ujian sering tidak memuatnya, dan soal tetap
    // berguna di bank untuk dilengkapi kemudian. Yang tetap salah adalah kunci
    // yang menunjuk opsi tidak tersedia. Soal tanpa kunci ditolak saat dipakai
    // menyusun ujian (lihat `save_managed_exam` pada migrasi 017).
    if (correctOption !== null && correctOption >= options.length) {
      errors.push("Kunci pilihan ganda menunjuk opsi yang tidak tersedia.");
    }
  } else if (answerKey.length > 10000) {
    errors.push("Pedoman jawaban melebihi 10.000 karakter.");
  }

  return {
    sourceNumber,
    type,
    text,
    difficulty: normalizeDifficulty(difficultyValue),
    options: type === "Pilihan Ganda" ? options : [],
    correctOption: type === "Pilihan Ganda" ? correctOption : null,
    answerKey: type === "Essay" ? answerKey : "",
    weight: Number.isFinite(weight) ? weight : 1,
    errors,
  };
}

export function parsePdfQuestions(text: string): PdfQuestionParseResult {
  const normalized = text
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n");
  const headerPattern =
    /^[ \t]*SOAL[ \t]+(\d+)[ \t]*(?:[:.)-][ \t]*)?(.*)$/gim;
  const headers = [...normalized.matchAll(headerPattern)];
  const errors: string[] = [];

  if (!headers.length) {
    return {
      questions: [],
      errors: [
        "Penanda ‘SOAL 1’, ‘SOAL 2’, dan seterusnya tidak ditemukan.",
      ],
    };
  }
  if (headers.length > MAX_QUESTIONS) {
    errors.push(
      `PDF berisi ${headers.length} soal. Hanya ${MAX_QUESTIONS} soal pertama yang diproses.`,
    );
  }

  const questions = headers.slice(0, MAX_QUESTIONS).map((header, index) => {
    const start = (header.index ?? 0) + header[0].length;
    const end = headers[index + 1]?.index ?? normalized.length;
    const inlineQuestion = header[2]?.trim();
    const block = `${inlineQuestion ? `PERTANYAAN: ${inlineQuestion}\n` : ""}${normalized.slice(start, end)}`;
    return parseBlock(Number(header[1]), block);
  });

  const seen = new Map<string, number>();
  for (const question of questions) {
    const key = question.text.toLowerCase().replace(/\s+/g, " ").trim();
    const previous = seen.get(key);
    if (key && previous !== undefined) {
      question.errors.push(`Pertanyaan sama dengan soal ${previous}.`);
    } else if (key) {
      seen.set(key, question.sourceNumber);
    }
  }

  return { questions, errors };
}

export function pdfTextItemsToLines(items: unknown[]): string[] {
  const lines: string[] = [];
  let current: string[] = [];
  let previousY: number | null = null;
  const flush = () => {
    const line = current
      .join(" ")
      .replace(/\s+([,.;:?!])/g, "$1")
      .trim();
    if (line) lines.push(line);
    current = [];
  };

  for (const item of items) {
    if (!item || typeof item !== "object" || !("str" in item)) continue;
    const textItem = item as {
      str: string;
      hasEOL?: boolean;
      transform?: number[];
    };
    const value = textItem.str.trim();
    const y = textItem.transform?.[5];
    if (
      previousY !== null &&
      typeof y === "number" &&
      Math.abs(y - previousY) > 2 &&
      current.length
    ) {
      flush();
    }
    if (value) current.push(value);
    if (textItem.hasEOL) flush();
    if (typeof y === "number") previousY = y;
  }
  flush();
  return lines;
}

export async function extractPdfText(file: File) {
  if (
    file.type !== "application/pdf" &&
    !file.name.toLowerCase().endsWith(".pdf")
  ) {
    throw new Error("Pilih berkas dengan format PDF.");
  }
  if (file.size === 0) throw new Error("Berkas PDF kosong.");
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Ukuran PDF maksimal 10 MB.");
  }

  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    isEvalSupported: false,
  });

  try {
    const document = await loadingTask.promise;
    if (document.numPages > MAX_PAGES) {
      throw new Error(`PDF maksimal ${MAX_PAGES} halaman.`);
    }
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(pdfTextItemsToLines(content.items).join("\n"));
      page.cleanup();
    }
    const text = pages.join("\n").trim();
    if (!text) {
      throw new Error(
        "PDF tidak memiliki teks yang dapat dibaca. PDF hasil scan/gambar perlu diubah menjadi searchable PDF terlebih dahulu.",
      );
    }
    return { text, pageCount: document.numPages };
  } catch (error) {
    if (error instanceof Error && error.message) throw error;
    throw new Error("PDF tidak dapat dibaca atau dilindungi kata sandi.");
  } finally {
    await loadingTask.destroy();
  }
}
