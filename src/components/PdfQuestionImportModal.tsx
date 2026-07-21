import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Upload,
  X,
} from "lucide-react";
import {
  extractPdfText,
  parsePdfQuestions,
  type ParsedPdfQuestion,
  type PdfQuestionParseResult,
} from "../lib/pdf-question-parser";
import {
  extractDocxQuestions,
  extractQtiQuestions,
  parseGiftQuestions,
} from "../lib/question-import-formats";
import {
  extractImageQuestions,
  type ImageOcrProgress,
} from "../lib/image-question-ocr";
import { extractQuestionsWithAi } from "../lib/ai-question-import";
import type { Question } from "../types";
import { findSimilarQuestion, normalizeQuestion } from "../lib/question-similarity";

type BankOption = {
  id: string;
  name: string;
  subject: string;
};

type Props = {
  banks: BankOption[];
  existingQuestions: Question[];
  initialBankId?: string;
  close: () => void;
  save: (bankId: string, questions: ParsedPdfQuestion[]) => Promise<boolean>;
};

export function PdfQuestionImportModal({
  banks,
  existingQuestions,
  initialBankId,
  close,
  save,
}: Props) {
  const [source, setSource] = useState<
    "pdf" | "image" | "paste" | "docx" | "gift" | "qti"
  >("pdf");
  const [bankId, setBankId] = useState(initialBankId ?? banks[0]?.id ?? "");
  const [sourceText, setSourceText] = useState("");
  const [fileName, setFileName] = useState("");
  const [pageCount, setPageCount] = useState(0);
  const [questions, setQuestions] = useState<ParsedPdfQuestion[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<ImageOcrProgress | null>(null);

  const existingBodies = useMemo(
    () =>
      existingQuestions
        .filter((question) => question.bankId === bankId)
        .map((question) => question.text),
    [bankId, existingQuestions],
  );

  const errorsFor = (question: ParsedPdfQuestion) => {
    const errors = [...question.errors];
    const exact = existingBodies.some(
      (body) => normalizeQuestion(body) === normalizeQuestion(question.text),
    );
    const similar = exact ? null : findSimilarQuestion(question.text, existingBodies);
    if (exact) {
      errors.push("Soal yang sama sudah ada di bank tujuan.");
    } else if (similar) {
      errors.push(`Soal sangat mirip (${Math.round(similar.score * 100)}%) dengan soal yang sudah ada.`);
    }
    return errors;
  };

  const validIndexes = questions
    .map((question, index) => (errorsFor(question).length ? -1 : index))
    .filter((index) => index >= 0);
  const selectedValidIndexes = validIndexes.filter((index) =>
    selected.has(index),
  );

  const applyResult = (
    result: PdfQuestionParseResult,
    label: string,
    pages = 0,
  ) => {
    setFileName(label);
    setPageCount(pages);
    setQuestions(result.questions);
    setParseErrors(result.errors);
    setSelected(
      new Set(
        result.questions
          .map((question, index) => (question.errors.length === 0 ? index : -1))
          .filter((index) => index >= 0),
      ),
    );
  };

  const resetResult = () => {
    setFileName("");
    setPageCount(0);
    setQuestions([]);
    setSelected(new Set());
    setParseErrors([]);
    setOcrProgress(null);
  };

  const choosePdf = async (file?: File) => {
    if (!file) return;
    setParsing(true);
    resetResult();
    try {
      const extracted = await extractPdfText(file);
      // Teks disimpan agar guru dapat memeriksanya dan menjalankan ulang
      // ekstraksi dengan cara lain tanpa memilih berkas ulang.
      setSourceText(extracted.text);
      applyResult(
        await extractQuestionsWithAi(extracted.text),
        file.name,
        extracted.pageCount,
      );
    } catch (error) {
      setParseErrors([
        error instanceof Error ? error.message : "PDF tidak dapat diproses.",
      ]);
    } finally {
      setParsing(false);
    }
  };

  /// Menjalankan ulang ekstraksi pada teks yang sudah dimuat — dipakai ketika
  /// hasil AI meleset, atau untuk naskah yang sudah berformat `SOAL 1`.
  const reparseSource = async (mode: "ai" | "format") => {
    if (!sourceText.trim() || parsing) return;
    setParsing(true);
    try {
      applyResult(
        mode === "ai"
          ? await extractQuestionsWithAi(sourceText)
          : parsePdfQuestions(sourceText),
        fileName || "Teks yang dimuat",
        pageCount,
      );
    } finally {
      setParsing(false);
    }
  };

  const chooseDocx = async (file?: File) => {
    if (!file) return;
    setParsing(true);
    resetResult();
    try {
      applyResult(await extractDocxQuestions(file), file.name);
    } catch (error) {
      setParseErrors([
        error instanceof Error ? error.message : "DOCX tidak dapat diproses.",
      ]);
    } finally {
      setParsing(false);
    }
  };

  const chooseQti = async (file?: File) => {
    if (!file) return;
    setParsing(true);
    resetResult();
    try {
      applyResult(await extractQtiQuestions(file), file.name);
    } catch (error) {
      setParseErrors([
        error instanceof Error ? error.message : "QTI tidak dapat diproses.",
      ]);
    } finally {
      setParsing(false);
    }
  };

  const chooseImages = async (fileList?: FileList | null) => {
    const files = Array.from(fileList ?? []);
    if (!files.length) return;
    setParsing(true);
    resetResult();
    try {
      const result = await extractImageQuestions(files, setOcrProgress);
      setSourceText(result.text);
      applyResult(
        result.parsed,
        files.length === 1 ? files[0].name : `${files.length} foto`,
        files.length,
      );
      setOcrProgress({
        current: files.length,
        total: files.length,
        progress: 1,
        status: "OCR selesai",
      });
    } catch (error) {
      setParseErrors([
        error instanceof Error ? error.message : "Foto tidak dapat diproses.",
      ]);
    } finally {
      setParsing(false);
    }
  };

  const parseTextSource = () => {
    resetResult();
    if (!sourceText.trim()) {
      setParseErrors(["Tempel teks soal terlebih dahulu."]);
      return;
    }
    applyResult(
      source === "gift"
        ? parseGiftQuestions(sourceText)
        : parsePdfQuestions(sourceText),
      source === "gift"
        ? "Teks GIFT"
        : source === "image"
          ? fileName || "Hasil OCR foto"
          : "Teks yang ditempel",
      source === "image" ? pageCount : 0,
    );
  };

  const submit = async () => {
    if (!bankId || !selectedValidIndexes.length || saving) return;
    setSaving(true);
    const saved = await save(
      bankId,
      selectedValidIndexes.map((index) => questions[index]),
    );
    if (!saved) setSaving(false);
  };

  return (
    <div className="modal-overlay" onMouseDown={close}>
      <div
        className="modal pdf-import-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="simple-modal">
          <header>
            <div>
              <p>IMPOR BANK SOAL</p>
              <h2>Tambah banyak soal</h2>
            </div>
            <button type="button" onClick={close} aria-label="Tutup impor soal">
              <X />
            </button>
          </header>

          <div className="modal-content pdf-import-content">
            <label className="form-field pdf-target-bank">
              <span>Bank soal tujuan</span>
              <select
                value={bankId}
                onChange={(event) => setBankId(event.target.value)}
                disabled={saving}
              >
                {banks.map((bank) => (
                  <option value={bank.id} key={bank.id}>
                    {bank.name} — {bank.subject}
                  </option>
                ))}
              </select>
            </label>

            <div className="question-import-tabs">
              {([
                ["pdf", "PDF"],
                ["image", "Foto/OCR"],
                ["paste", "Tempel teks"],
                ["docx", "Word/DOCX"],
                ["gift", "GIFT"],
                ["qti", "QTI"],
              ] as const).map(([value, label]) => (
                <button
                  type="button"
                  className={source === value ? "active" : ""}
                  onClick={() => {
                    setSource(value);
                    resetResult();
                  }}
                  key={value}
                >
                  {label}
                </button>
              ))}
            </div>

            {source === "pdf" && (
              <>
                <label className={`pdf-file-picker ${parsing ? "disabled" : ""}`}>
                  <Upload />
                  <span>
                    <b>{parsing ? "Membaca PDF…" : "Pilih berkas PDF"}</b>
                    <small>
                      Soal dikenali otomatis oleh AI. Maksimal 10 MB dan 100 halaman.
                    </small>
                  </span>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    disabled={parsing || saving}
                    onChange={(event) => void choosePdf(event.target.files?.[0])}
                  />
                </label>
                {sourceText.trim() && (
                  <div className="question-import-retry">
                    <span>Hasil belum tepat?</span>
                    <button
                      type="button"
                      disabled={parsing || saving}
                      onClick={() => void reparseSource("ai")}
                    >
                      Coba AI lagi
                    </button>
                    <button
                      type="button"
                      disabled={parsing || saving}
                      onClick={() => void reparseSource("format")}
                    >
                      Baca sebagai format SOAL 1
                    </button>
                  </div>
                )}
              </>
            )}
            {source === "docx" && (
              <label className={`pdf-file-picker ${parsing ? "disabled" : ""}`}>
                <Upload />
                <span><b>{parsing ? "Membaca Word…" : "Pilih dokumen Word"}</b><small>DOCX maksimal 10 MB</small></span>
                <input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" disabled={parsing || saving} onChange={(event) => void chooseDocx(event.target.files?.[0])} />
              </label>
            )}
            {source === "image" && (
              <>
                <label className={`pdf-file-picker ${parsing ? "disabled" : ""}`}>
                  <Upload />
                  <span>
                    <b>{parsing ? "Membaca foto…" : "Pilih atau ambil foto soal"}</b>
                    <small>JPG, PNG, atau WebP · maksimal 5 foto, masing-masing 10 MB</small>
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    disabled={parsing || saving}
                    onChange={(event) => void chooseImages(event.target.files)}
                  />
                </label>
                {ocrProgress && (
                  <div className="ocr-progress" aria-live="polite">
                    <div>
                      <span>{ocrProgress.status}</span>
                      <b>{Math.round(ocrProgress.progress * 100)}%</b>
                    </div>
                    <progress value={ocrProgress.progress} max={1} />
                    <small>
                      Foto {ocrProgress.current} dari {ocrProgress.total}. Pemrosesan dilakukan di perangkat ini.
                    </small>
                  </div>
                )}
                {sourceText && (
                  <div className="question-paste-source ocr-text-review">
                    <label htmlFor="ocr-question-text">Periksa dan koreksi hasil OCR</label>
                    <textarea
                      id="ocr-question-text"
                      rows={10}
                      value={sourceText}
                      disabled={parsing || saving}
                      onChange={(event) => setSourceText(event.target.value)}
                    />
                    <button type="button" className="primary" disabled={parsing || saving} onClick={parseTextSource}>
                      Perbarui preview
                    </button>
                  </div>
                )}
              </>
            )}
            {source === "qti" && (
              <label className={`pdf-file-picker ${parsing ? "disabled" : ""}`}>
                <Upload />
                <span><b>{parsing ? "Membaca QTI…" : "Pilih paket QTI"}</b><small>QTI XML atau ZIP maksimal 10 MB</small></span>
                <input type="file" accept=".xml,.zip,application/xml,application/zip" disabled={parsing || saving} onChange={(event) => void chooseQti(event.target.files?.[0])} />
              </label>
            )}
            {(source === "paste" || source === "gift") && (
              <div className="question-paste-source">
                <textarea
                  rows={10}
                  value={sourceText}
                  onChange={(event) => setSourceText(event.target.value)}
                  placeholder={source === "gift" ? "Tempel soal dengan format GIFT…" : "Tempel soal dari Word, WhatsApp, atau dokumen…"}
                />
                <button type="button" className="primary" onClick={parseTextSource}>Baca teks</button>
              </div>
            )}

            {(source === "pdf" || source === "image" || source === "paste" || source === "docx") && <details className="pdf-format-guide">
              <summary>Format teks yang didukung</summary>
              <p>
                Buat dokumen di Word/Google Docs dengan format berikut, lalu
                simpan sebagai PDF, unggah DOCX, atau foto dokumennya. Untuk
                hasil OCR foto, periksa kembali teks dan tambahkan KUNCI atau
                JAWABAN jika belum tercetak pada foto.
              </p>
              <pre>{`SOAL 1
TIPE: PG
PERTANYAAN: Hasil dari 2 + 3 adalah ...
A. 4
B. 5
C. 6
D. 7
KUNCI: B
KESULITAN: Mudah
BOBOT: 1

SOAL 2
TIPE: ESSAY
PERTANYAAN: Jelaskan proses fotosintesis.
JAWABAN: Tumbuhan mengubah air dan karbon dioksida menjadi glukosa dengan bantuan cahaya.
KESULITAN: Sedang
BOBOT: 2`}</pre>
            </details>}

            {parseErrors.length > 0 && (
              <div className="pdf-global-errors" role="alert">
                <AlertTriangle />
                <div>
                  {parseErrors.map((error) => (
                    <p key={error}>{error}</p>
                  ))}
                </div>
              </div>
            )}

            {questions.length > 0 && (
              <div className="pdf-preview">
                <div className="pdf-preview-head">
                  <div>
                    <b>Preview hasil</b>
                    <small>
                      {fileName}{pageCount ? ` · ${pageCount} halaman` : ""} · {validIndexes.length} dari{" "}
                      {questions.length} soal valid
                    </small>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setSelected(
                        selectedValidIndexes.length === validIndexes.length
                          ? new Set()
                          : new Set(validIndexes),
                      )
                    }
                  >
                    {selectedValidIndexes.length === validIndexes.length
                      ? "Kosongkan pilihan"
                      : "Pilih semua valid"}
                  </button>
                </div>

                <div className="pdf-question-list">
                  {questions.map((question, index) => {
                    const errors = errorsFor(question);
                    const valid = errors.length === 0;
                    return (
                      <article
                        className={valid ? "valid" : "invalid"}
                        key={`${question.sourceNumber}-${index}`}
                      >
                        <label>
                          <input
                            type="checkbox"
                            checked={valid && selected.has(index)}
                            disabled={!valid || saving}
                            onChange={(event) =>
                              setSelected((current) => {
                                const next = new Set(current);
                                if (event.target.checked) next.add(index);
                                else next.delete(index);
                                return next;
                              })
                            }
                          />
                          <span>
                            {valid ? <CheckCircle2 /> : <AlertTriangle />}
                          </span>
                          <div>
                            <small>
                              SOAL {question.sourceNumber} · {question.type} ·{" "}
                              {question.difficulty} · bobot {question.weight}
                            </small>
                            <b>{question.text || "Pertanyaan kosong"}</b>
                            {question.type === "Pilihan Ganda" && (
                              <p>
                                {question.options
                                  .map(
                                    (option, optionIndex) =>
                                      `${String.fromCharCode(65 + optionIndex)}. ${option}`,
                                  )
                                  .join(" · ")}
                              </p>
                            )}
                            {errors.map((error) => (
                              <em key={error}>{error}</em>
                            ))}
                          </div>
                        </label>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <footer>
            <button type="button" onClick={close} disabled={saving}>
              Batal
            </button>
            <button
              type="button"
              className="primary"
              disabled={!bankId || !selectedValidIndexes.length || parsing || saving}
              onClick={() => void submit()}
            >
              {saving
                ? "Mengimpor…"
                : `Impor ${selectedValidIndexes.length} soal`}
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
}
