import {
  parsePdfQuestions,
  type ParsedPdfQuestion,
  type PdfQuestionParseResult,
} from "./pdf-question-parser";

const MAX_IMPORT_SIZE = 10 * 1024 * 1024;

function validateFile(file: File, extensions: string[]) {
  if (!extensions.some((extension) => file.name.toLowerCase().endsWith(extension))) {
    throw new Error(`Format berkas harus ${extensions.join(" atau ")}.`);
  }
  if (!file.size) throw new Error("Berkas kosong.");
  if (file.size > MAX_IMPORT_SIZE) throw new Error("Ukuran berkas maksimal 10 MB.");
}

export async function extractDocxQuestions(file: File) {
  validateFile(file, [".docx"]);
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  // Build browser Mammoth membaca arrayBuffer, sedangkan entrypoint Node yang
  // dipakai regression test membaca buffer. Menyediakan keduanya aman karena
  // masing-masing runtime hanya mengambil properti yang dikenalnya.
  const input = {
    arrayBuffer,
    buffer: new Uint8Array(arrayBuffer),
  } as unknown as Parameters<typeof mammoth.extractRawText>[0];
  const result = await mammoth.extractRawText(input);
  if (!result.value.trim()) throw new Error("Dokumen Word tidak memiliki teks.");
  const parsed = parsePdfQuestions(result.value);
  if (result.messages.length) {
    parsed.errors.push("Sebagian format Word disederhanakan menjadi teks biasa.");
  }
  return parsed;
}

export function parseGiftQuestions(text: string): PdfQuestionParseResult {
  const blocks = text
    .replace(/\r/g, "")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);
  const structured: string[] = [];
  const errors: string[] = [];

  blocks.forEach((block, index) => {
    const match = block.match(/^(.*?)\{([\s\S]*)\}\s*$/);
    if (!match) {
      errors.push(`Blok GIFT ${index + 1} tidak memiliki jawaban dalam { }.`);
      return;
    }
    const prompt = match[1].replace(/^::.*?::\s*/, "").trim();
    const answers = [...match[2].matchAll(/([=~])([^=~#}]+)(?:#[^=~}]*)?/g)].map(
      (answer) => ({ correct: answer[1] === "=", text: answer[2].trim() }),
    );
    const correct = answers.findIndex((answer) => answer.correct);
    if (!prompt || correct < 0) {
      errors.push(`Blok GIFT ${index + 1} tidak memiliki pertanyaan atau kunci.`);
      return;
    }
    if (answers.length === 1) {
      structured.push(`SOAL ${index + 1}\nTIPE: ESSAY\nPERTANYAAN: ${prompt}\nJAWABAN: ${answers[0].text}`);
      return;
    }
    structured.push(
      [
        `SOAL ${index + 1}`,
        "TIPE: PG",
        `PERTANYAAN: ${prompt}`,
        ...answers.map(
          (answer, answerIndex) =>
            `${String.fromCharCode(65 + answerIndex)}. ${answer.text}`,
        ),
        `KUNCI: ${String.fromCharCode(65 + correct)}`,
      ].join("\n"),
    );
  });

  const parsed = structured.length
    ? parsePdfQuestions(structured.join("\n\n"))
    : { questions: [], errors: [] };
  return { questions: parsed.questions, errors: [...errors, ...parsed.errors] };
}

function elements(root: ParentNode, localName: string) {
  return [...root.querySelectorAll("*")].filter(
    (element) => element.localName.toLowerCase() === localName.toLowerCase(),
  );
}

function directText(element?: Element) {
  return element?.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

function parseQtiXml(xml: string, startNumber: number): ParsedPdfQuestion[] {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.querySelector("parsererror")) return [];
  const qti2Items = elements(document, "assessmentItem");
  const qti1Items = elements(document, "item");
  const items = qti2Items.length ? qti2Items : qti1Items;

  return items.map((item, itemIndex) => {
    const choiceElements = elements(item, "simpleChoice").length
      ? elements(item, "simpleChoice")
      : elements(item, "response_label");
    const promptElement =
      elements(item, "prompt")[0] ?? elements(item, "material")[0];
    const prompt = directText(promptElement);
    const options = choiceElements.map(directText);
    const identifiers = choiceElements.map(
      (choice, index) =>
        choice.getAttribute("identifier") ??
        choice.getAttribute("ident") ??
        String.fromCharCode(65 + index),
    );
    const correctValue = directText(
      elements(item, "correctResponse")[0] ?? elements(item, "varequal")[0],
    );
    const correctOption = identifiers.findIndex(
      (identifier) => identifier === correctValue,
    );
    const errors: string[] = [];
    if (!prompt) errors.push("Teks pertanyaan QTI tidak ditemukan.");
    if (options.length < 2) errors.push("QTI saat ini hanya mendukung pilihan ganda minimal dua opsi.");
    if (correctOption < 0) errors.push("Kunci jawaban QTI tidak ditemukan.");
    return {
      sourceNumber: startNumber + itemIndex,
      type: "Pilihan Ganda" as const,
      text: prompt,
      difficulty: "Sedang" as const,
      options,
      correctOption: correctOption < 0 ? null : correctOption,
      answerKey: "",
      weight: 1,
      errors,
    };
  });
}

export async function extractQtiQuestions(file: File): Promise<PdfQuestionParseResult> {
  validateFile(file, [".xml", ".zip"]);
  const errors: string[] = [];
  const questions: ParsedPdfQuestion[] = [];

  if (file.name.toLowerCase().endsWith(".xml")) {
    questions.push(...parseQtiXml(await file.text(), 1));
  } else {
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const xmlFiles = Object.values(zip.files).filter(
      (entry) => !entry.dir && entry.name.toLowerCase().endsWith(".xml"),
    );
    for (const entry of xmlFiles) {
      const parsed = parseQtiXml(await entry.async("text"), questions.length + 1);
      questions.push(...parsed);
    }
  }

  if (!questions.length) errors.push("Paket QTI tidak berisi soal yang didukung.");
  if (questions.length > 100) {
    errors.push("QTI berisi lebih dari 100 soal; hanya 100 soal pertama diproses.");
  }
  return { questions: questions.slice(0, 100), errors };
}
