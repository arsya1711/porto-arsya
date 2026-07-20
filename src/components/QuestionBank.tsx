import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  BookOpen,
  FileUp,
  FileQuestion,
  ListChecks,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { supabase } from "../lib/supabase";
import type { ParsedPdfQuestion } from "../lib/pdf-question-parser";
import { findSimilarQuestion, normalizeQuestion } from "../lib/question-similarity";
import { type Question } from "../types";
import { PdfQuestionImportModal } from "./PdfQuestionImportModal";
import { QuestionBulkToolsModal } from "./QuestionBulkToolsModal";

type Notify = (text: string, error?: boolean) => void;
type SubjectOption = { id: string; name: string };
type Bank = {
  id: string;
  name: string;
  subjectId: string;
  subject: string;
  gradeLevel: string;
  questionCount: number;
};
type QuestionDraft = {
  id?: string;
  bankId: string;
  type: Question["type"];
  text: string;
  difficulty: Question["difficulty"];
  options: string[];
  correctOption: number | null;
  answerKey: string;
  weight: number;
};
type BankDraft = {
  id?: string;
  name: string;
  subjectId: string;
  gradeLevel: string;
};

function relationName(value: unknown): string {
  if (Array.isArray(value)) return String(value[0]?.name ?? "—");
  if (value && typeof value === "object" && "name" in value) {
    return String(value.name);
  }
  return "—";
}

function nestedSubjectName(value: unknown): string {
  const bank = Array.isArray(value) ? value[0] : value;
  if (bank && typeof bank === "object" && "subjects" in bank) {
    return relationName(bank.subjects);
  }
  return "—";
}

function titleCase(value: string) {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

export function QuestionBank({ notify }: { notify: Notify }) {
  const { profile } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [createQuestion, setCreateQuestion] = useState(false);
  const [importPdf, setImportPdf] = useState(false);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());
  const [bulkTools, setBulkTools] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [createBank, setCreateBank] = useState(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [selectedBank, setSelectedBank] = useState("all");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | Question["type"]>("all");
  const [difficultyFilter, setDifficultyFilter] = useState<
    "all" | Question["difficulty"]
  >("all");

  const loadData = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      notify("Server belum dikonfigurasi. Bank soal tidak dapat digunakan.", true);
      return;
    }

    setLoading(true);
    const [subjectResult, bankResult, questionResult] = await Promise.all([
      supabase.from("subjects").select("id,name").order("name"),
      supabase
        .from("question_banks")
        .select("id,name,subject_id,grade_level,subjects(name)")
        .order("name"),
      supabase
        .from("questions")
        .select(
          "id,bank_id,body,type,options,correct_option,answer_key,difficulty,weight,usage_count,created_at,question_banks(name,subjects(name))",
        )
        .eq("archived", false)
        .order("created_at", { ascending: false }),
    ]);

    const loadError =
      subjectResult.error ?? bankResult.error ?? questionResult.error;
    if (loadError) {
      setLoading(false);
      notify(loadError.message || "Data Bank Soal gagal dimuat", true);
      return;
    }

    const normalizedQuestions: Question[] = (questionResult.data ?? []).map(
      (row) => ({
        id: row.id,
        bankId: row.bank_id ?? undefined,
        bank: relationName(row.question_banks),
        subject: nestedSubjectName(row.question_banks),
        type: row.type === "multiple_choice" ? "Pilihan Ganda" : "Essay",
        text: row.body,
        difficulty: titleCase(row.difficulty) as Question["difficulty"],
        used: row.usage_count ?? 0,
        options: Array.isArray(row.options)
          ? row.options.map((option) => String(option))
          : [],
        correctOption: row.correct_option,
        answerKey: row.answer_key,
        weight: Number(row.weight ?? 1),
        createdAt: row.created_at,
      }),
    );
    const normalizedBanks: Bank[] = (bankResult.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      subjectId: row.subject_id ?? "",
      subject: relationName(row.subjects),
      gradeLevel: row.grade_level ?? "",
      questionCount: normalizedQuestions.filter(
        (question) => question.bankId === row.id,
      ).length,
    }));

    setSubjects(subjectResult.data ?? []);
    setQuestions(normalizedQuestions);
    setSelectedQuestionIds(new Set());
    setBanks(normalizedBanks);
    setLoading(false);
  }, [notify]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const saveQuestion = async (draft: QuestionDraft) => {
    try {
      const bank = banks.find((item) => item.id === draft.bankId);
      if (!bank) throw new Error("Pilih bank soal terlebih dahulu");

      if (supabase) {
        const payload = {
          bank_id: draft.bankId,
          body: draft.text.trim(),
          type: draft.type === "Pilihan Ganda" ? "multiple_choice" : "essay",
          options:
            draft.type === "Pilihan Ganda"
              ? draft.options.map((option) => option.trim())
              : null,
          correct_option:
            draft.type === "Pilihan Ganda" ? draft.correctOption : null,
          answer_key: draft.type === "Essay" ? draft.answerKey.trim() : null,
          difficulty: draft.difficulty.toLowerCase(),
          weight: draft.weight,
        };
        const result = draft.id
          ? await supabase.from("questions").update(payload).eq("id", draft.id)
          : await supabase.from("questions").insert({
              ...payload,
              created_by: profile?.id,
            });
        if (result.error) throw result.error;
        await loadData();
      } else {
        const next: Question = {
          id: draft.id ?? `Q-${Date.now().toString().slice(-6)}`,
          bankId: bank.id,
          bank: bank.name,
          subject: bank.subject,
          type: draft.type,
          text: draft.text.trim(),
          difficulty: draft.difficulty,
          used: draft.id
            ? (questions.find((question) => question.id === draft.id)?.used ??
              0)
            : 0,
          options: draft.options,
          correctOption: draft.correctOption,
          answerKey: draft.answerKey,
          weight: draft.weight,
          createdAt:
            questions.find((question) => question.id === draft.id)?.createdAt ??
            new Date().toISOString(),
        };
        setQuestions((current) =>
          draft.id
            ? current.map((question) =>
                question.id === draft.id ? next : question,
              )
            : [next, ...current],
        );
      }
      setCreateQuestion(false);
      setEditingQuestion(null);
      notify(
        draft.id ? "Soal berhasil diperbarui" : "Soal berhasil ditambahkan",
      );
      return true;
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Soal gagal disimpan",
        true,
      );
      return false;
    }
  };

  const importQuestions = async (
    bankId: string,
    importedQuestions: ParsedPdfQuestion[],
  ) => {
    try {
      if (!supabase || !profile?.id) {
        throw new Error("Sesi guru tidak tersedia. Silakan masuk kembali.");
      }
      if (!banks.some((bank) => bank.id === bankId)) {
        throw new Error("Bank soal tujuan tidak ditemukan.");
      }
      if (!importedQuestions.length || importedQuestions.length > 100) {
        throw new Error("Pilih antara 1 sampai 100 soal untuk diimpor.");
      }

      const payload = importedQuestions.map((question) => ({
        bank_id: bankId,
        body: question.text.trim(),
        type:
          question.type === "Pilihan Ganda" ? "multiple_choice" : "essay",
        options:
          question.type === "Pilihan Ganda"
            ? question.options.map((option) => option.trim())
            : null,
        correct_option:
          question.type === "Pilihan Ganda" ? question.correctOption : null,
        answer_key:
          question.type === "Essay" ? question.answerKey.trim() : null,
        difficulty: question.difficulty.toLowerCase(),
        weight: question.weight,
        created_by: profile.id,
      }));
      const { error } = await supabase.from("questions").insert(payload);
      if (error) throw error;

      await loadData();
      setSelectedBank(bankId);
      setImportPdf(false);
      notify(`${payload.length} soal dari PDF berhasil diimpor`);
      return true;
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Soal dari PDF gagal diimpor",
        true,
      );
      return false;
    }
  };

  const selectedQuestions = questions.filter((question) =>
    selectedQuestionIds.has(question.id),
  );

  const copySelectedQuestions = async (targetBankId: string) => {
    try {
      if (!supabase || !profile?.id) throw new Error("Sesi guru tidak tersedia.");
      const targetBodies = questions
        .filter((question) => question.bankId === targetBankId)
        .map((question) => question.text);
      const copied: Question[] = [];
      let skipped = 0;
      for (const question of selectedQuestions) {
        const exact = targetBodies.some(
          (body) => normalizeQuestion(body) === normalizeQuestion(question.text),
        );
        if (exact || findSimilarQuestion(question.text, targetBodies)) {
          skipped++;
          continue;
        }
        copied.push(question);
        targetBodies.push(question.text);
      }
      if (!copied.length) throw new Error("Semua soal sudah ada atau sangat mirip di bank tujuan.");
      const { error } = await supabase.from("questions").insert(
        copied.map((question) => ({
          bank_id: targetBankId,
          body: question.text,
          type: question.type === "Pilihan Ganda" ? "multiple_choice" : "essay",
          options: question.type === "Pilihan Ganda" ? question.options : null,
          correct_option: question.type === "Pilihan Ganda" ? question.correctOption : null,
          answer_key: question.type === "Essay" ? question.answerKey : null,
          difficulty: question.difficulty.toLowerCase(),
          weight: question.weight ?? 1,
          created_by: profile.id,
        })),
      );
      if (error) throw error;
      await loadData();
      setBulkTools(false);
      notify(`${copied.length} soal disalin${skipped ? `, ${skipped} duplikat dilewati` : ""}`);
      return true;
    } catch (error) {
      notify(error instanceof Error ? error.message : "Soal gagal disalin", true);
      return false;
    }
  };

  const updateSelectedQuestions = async (update: {
    bankId?: string;
    difficulty?: Question["difficulty"];
    weight?: number;
  }) => {
    try {
      if (!supabase || !selectedQuestions.length) throw new Error("Tidak ada soal yang dipilih.");
      const payload: Record<string, string | number> = {};
      if (update.bankId) payload.bank_id = update.bankId;
      if (update.difficulty) payload.difficulty = update.difficulty.toLowerCase();
      if (update.weight !== undefined) payload.weight = update.weight;
      if (!Object.keys(payload).length) throw new Error("Pilih perubahan yang akan diterapkan.");
      const { error } = await supabase
        .from("questions")
        .update(payload)
        .in("id", selectedQuestions.map((question) => question.id));
      if (error) throw error;
      await loadData();
      setBulkTools(false);
      notify(`${selectedQuestions.length} soal berhasil diperbarui`);
      return true;
    } catch (error) {
      notify(error instanceof Error ? error.message : "Perubahan massal gagal", true);
      return false;
    }
  };

  const removeQuestion = async (question: Question) => {
    if (!window.confirm(`Hapus soal “${question.text.slice(0, 70)}”?`)) return;
    try {
      if (supabase) {
        const { error } = await supabase
          .from("questions")
          .update({ archived: true })
          .eq("id", question.id);
        if (error) throw error;
        await loadData();
      } else {
        setQuestions((current) =>
          current.filter((item) => item.id !== question.id),
        );
      }
      notify("Soal berhasil dihapus dari daftar aktif");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Soal gagal dihapus",
        true,
      );
    }
  };

  const saveBank = async (draft: BankDraft) => {
    try {
      if (
        banks.some(
          (bank) =>
            bank.id !== draft.id &&
            bank.name.toLowerCase() === draft.name.trim().toLowerCase(),
        )
      ) {
        throw new Error("Nama bank soal sudah digunakan");
      }
      if (supabase) {
        const payload = {
          name: draft.name.trim(),
          subject_id: draft.subjectId,
          grade_level: draft.gradeLevel.trim() || null,
        };
        const result = draft.id
          ? await supabase
              .from("question_banks")
              .update(payload)
              .eq("id", draft.id)
          : await supabase.from("question_banks").insert({
              ...payload,
              owner_id: profile?.id,
            });
        if (result.error) throw result.error;
        await loadData();
      } else {
        const subject = subjects.find((item) => item.id === draft.subjectId);
        const next: Bank = {
          id: draft.id ?? `bank-${Date.now()}`,
          name: draft.name.trim(),
          subjectId: draft.subjectId,
          subject: subject?.name ?? "—",
          gradeLevel: draft.gradeLevel.trim(),
          questionCount:
            banks.find((bank) => bank.id === draft.id)?.questionCount ?? 0,
        };
        setBanks((current) =>
          draft.id
            ? current.map((bank) => (bank.id === draft.id ? next : bank))
            : [...current, next],
        );
      }
      setCreateBank(false);
      setEditingBank(null);
      notify(
        draft.id
          ? "Bank soal berhasil diperbarui"
          : "Bank soal berhasil dibuat",
      );
      return true;
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Bank soal gagal disimpan",
        true,
      );
      return false;
    }
  };

  const removeBank = async (bank: Bank) => {
    if (bank.questionCount > 0) {
      notify("Pindahkan atau hapus semua soal sebelum menghapus bank", true);
      return;
    }
    try {
      if (supabase) {
        const { count, error: countError } = await supabase
          .from("questions")
          .select("id", { count: "exact", head: true })
          .eq("bank_id", bank.id);
        if (countError) throw countError;
        if (count) {
          notify("Pindahkan atau hapus semua soal sebelum menghapus bank", true);
          return;
        }
      }
      if (!window.confirm(`Hapus bank soal “${bank.name}”?`)) return;
      if (supabase) {
        const { error } = await supabase
          .from("question_banks")
          .delete()
          .eq("id", bank.id);
        if (error) throw error;
        await loadData();
      } else {
        setBanks((current) => current.filter((item) => item.id !== bank.id));
      }
      if (selectedBank === bank.id) setSelectedBank("all");
      notify("Bank soal berhasil dihapus");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Bank soal gagal dihapus",
        true,
      );
    }
  };

  const visibleQuestions = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return questions.filter(
      (question) =>
        (selectedBank === "all" || question.bankId === selectedBank) &&
        (typeFilter === "all" || question.type === typeFilter) &&
        (difficultyFilter === "all" ||
          question.difficulty === difficultyFilter) &&
        (!keyword ||
          question.text.toLowerCase().includes(keyword) ||
          question.bank.toLowerCase().includes(keyword) ||
          question.subject.toLowerCase().includes(keyword)),
    );
  }, [difficultyFilter, questions, search, selectedBank, typeFilter]);

  const addedThisMonth = questions.filter((question) => {
    if (!question.createdAt) return false;
    const created = new Date(question.createdAt);
    const now = new Date();
    return (
      created.getMonth() === now.getMonth() &&
      created.getFullYear() === now.getFullYear()
    );
  }).length;

  return (
    <div className="portal-page">
      <div className="page-title">
        <div>
          <span>KONTEN PEMBELAJARAN</span>
          <h1>Bank Soal</h1>
          <p>
            {questions.length} soal aktif dari{" "}
            {new Set(questions.map((q) => q.subject)).size} mata pelajaran.
          </p>
        </div>
        <div className="title-actions">
          <button onClick={() => setCreateBank(true)}>
            <BookOpen /> Bank baru
          </button>
          <button
            onClick={() => setImportPdf(true)}
            disabled={!banks.length}
            title={!banks.length ? "Buat bank soal terlebih dahulu" : undefined}
          >
            <FileUp /> Impor soal
          </button>
          {selectedQuestionIds.size > 0 && (
            <button onClick={() => setBulkTools(true)}>
              <ListChecks /> Kelola {selectedQuestionIds.size}
            </button>
          )}
          <button
            className="primary"
            onClick={() => setCreateQuestion(true)}
            disabled={!banks.length}
            title={!banks.length ? "Buat bank soal terlebih dahulu" : undefined}
          >
            <Plus /> Tambah soal
          </button>
        </div>
      </div>

      <div className="bank-summary">
        <Summary icon={<BookOpen />} label="TOTAL BANK" value={banks.length} />
        <Summary
          icon={<FileQuestion />}
          label="SOAL AKTIF"
          value={questions.length}
        />
        <Summary
          icon={<Sparkles />}
          label="DITAMBAHKAN BULAN INI"
          value={addedThisMonth}
        />
      </div>

      <div className="toolbar question-toolbar">
        <div>
          <Search />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari isi soal, bank, atau mata pelajaran…"
          />
        </div>
        <div className="question-filters">
          <select
            aria-label="Filter tipe soal"
            value={typeFilter}
            onChange={(event) =>
              setTypeFilter(event.target.value as typeof typeFilter)
            }
          >
            <option value="all">Semua tipe</option>
            <option value="Pilihan Ganda">Pilihan Ganda</option>
            <option value="Essay">Essay</option>
          </select>
          <select
            aria-label="Filter tingkat kesulitan"
            value={difficultyFilter}
            onChange={(event) =>
              setDifficultyFilter(event.target.value as typeof difficultyFilter)
            }
          >
            <option value="all">Semua tingkat</option>
            <option value="Mudah">Mudah</option>
            <option value="Sedang">Sedang</option>
            <option value="Sulit">Sulit</option>
          </select>
        </div>
      </div>

      <div className="question-layout">
        <aside className="bank-list">
          <h3>
            BANK SOAL
            <button
              title="Buat bank soal"
              aria-label="Buat bank soal"
              onClick={() => setCreateBank(true)}
            >
              <Plus />
            </button>
          </h3>
          <BankItem
            active={selectedBank === "all"}
            name="Semua soal"
            meta={`${questions.length} soal`}
            icon={<FileQuestion />}
            select={() => setSelectedBank("all")}
          />
          {banks.map((bank) => (
            <BankItem
              key={bank.id}
              active={selectedBank === bank.id}
              name={bank.name}
              meta={`${bank.questionCount} soal · ${bank.subject}`}
              icon={<BookOpen />}
              select={() => setSelectedBank(bank.id)}
              edit={() => setEditingBank(bank)}
              remove={() => void removeBank(bank)}
            />
          ))}
        </aside>

        <div className="table-card question-table">
          <table>
            <thead>
              <tr>
                <th className="question-select-column">
                  <input
                    type="checkbox"
                    aria-label="Pilih semua soal yang tampil"
                    checked={visibleQuestions.length > 0 && visibleQuestions.every((question) => selectedQuestionIds.has(question.id))}
                    onChange={(event) => setSelectedQuestionIds((current) => {
                      const next = new Set(current);
                      for (const question of visibleQuestions) {
                        if (event.target.checked) next.add(question.id);
                        else next.delete(question.id);
                      }
                      return next;
                    })}
                  />
                </th>
                <th>SOAL</th>
                <th>TIPE</th>
                <th>TINGKAT</th>
                <th>BOBOT</th>
                <th>DIPAKAI</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <EmptyRow text="Memuat bank soal…" />
              ) : visibleQuestions.length ? (
                visibleQuestions.map((question) => (
                  <tr key={question.id}>
                    <td className="question-select-column">
                      <input
                        type="checkbox"
                        aria-label={`Pilih soal ${question.text}`}
                        checked={selectedQuestionIds.has(question.id)}
                        onChange={(event) => setSelectedQuestionIds((current) => {
                          const next = new Set(current);
                          if (event.target.checked) next.add(question.id);
                          else next.delete(question.id);
                          return next;
                        })}
                      />
                    </td>
                    <td>
                      <div className="question-cell">
                        <small>
                          {question.bank} · {question.subject}
                        </small>
                        <b title={question.text}>{question.text}</b>
                      </div>
                    </td>
                    <td>
                      <span className="type-badge">{question.type}</span>
                    </td>
                    <td>
                      <span
                        className={`difficulty ${question.difficulty.toLowerCase()}`}
                      >
                        {question.difficulty}
                      </span>
                    </td>
                    <td>{question.weight ?? 1}</td>
                    <td>{question.used} ujian</td>
                    <td>
                      <div className="question-actions">
                        <button
                          title="Edit soal"
                          aria-label="Edit soal"
                          onClick={() => setEditingQuestion(question)}
                        >
                          <Pencil />
                        </button>
                        <button
                          className="danger"
                          title="Hapus soal"
                          aria-label="Hapus soal"
                          onClick={() => void removeQuestion(question)}
                        >
                          <Trash2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <EmptyRow
                  text={
                    questions.length
                      ? "Tidak ada soal yang cocok dengan filter."
                      : "Belum ada soal. Buat bank lalu tambahkan soal pertama."
                  }
                />
              )}
            </tbody>
          </table>
          {!loading && (
            <div className="table-footer">
              <span>Menampilkan {visibleQuestions.length} soal</span>
            </div>
          )}
        </div>
      </div>

      {(createQuestion || editingQuestion) && (
        <QuestionModal
          banks={banks}
          initial={editingQuestion ?? undefined}
          close={() => {
            setCreateQuestion(false);
            setEditingQuestion(null);
          }}
          save={saveQuestion}
        />
      )}
      {importPdf && (
        <PdfQuestionImportModal
          banks={banks}
          existingQuestions={questions}
          initialBankId={selectedBank === "all" ? undefined : selectedBank}
          close={() => setImportPdf(false)}
          save={importQuestions}
        />
      )}
      {bulkTools && selectedQuestions.length > 0 && (
        <QuestionBulkToolsModal
          questions={selectedQuestions}
          banks={banks}
          close={() => setBulkTools(false)}
          copyQuestions={copySelectedQuestions}
          updateQuestions={updateSelectedQuestions}
        />
      )}
      {(createBank || editingBank) && (
        <BankModal
          subjects={subjects}
          initial={editingBank ?? undefined}
          close={() => {
            setCreateBank(false);
            setEditingBank(null);
          }}
          save={saveBank}
        />
      )}
    </div>
  );
}

function Summary({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div>
      <span>{icon}</span>
      <p>
        <small>{label}</small>
        <b>{value}</b>
      </p>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <tr>
      <td colSpan={7} className="question-empty">
        {text}
      </td>
    </tr>
  );
}

function BankItem({
  active,
  name,
  meta,
  icon,
  select,
  edit,
  remove,
}: {
  active: boolean;
  name: string;
  meta: string;
  icon: ReactNode;
  select: () => void;
  edit?: () => void;
  remove?: () => void;
}) {
  return (
    <div className={`bank-item ${active ? "active" : ""}`}>
      <button className="bank-select" onClick={select}>
        <span>{icon}</span>
        <p>
          {name}
          <small>{meta}</small>
        </p>
      </button>
      {edit && remove && (
        <div className="bank-actions">
          <button title="Edit bank" aria-label={`Edit ${name}`} onClick={edit}>
            <Pencil />
          </button>
          <button
            className="danger"
            title="Hapus bank"
            aria-label={`Hapus ${name}`}
            onClick={remove}
          >
            <Trash2 />
          </button>
        </div>
      )}
    </div>
  );
}

function QuestionModal({
  banks,
  initial,
  close,
  save,
}: {
  banks: Bank[];
  initial?: Question;
  close: () => void;
  save: (draft: QuestionDraft) => Promise<boolean>;
}) {
  const [bankId, setBankId] = useState(initial?.bankId ?? banks[0]?.id ?? "");
  const [type, setType] = useState<Question["type"]>(
    initial?.type ?? "Pilihan Ganda",
  );
  const [text, setText] = useState(initial?.text ?? "");
  const [difficulty, setDifficulty] = useState<Question["difficulty"]>(
    initial?.difficulty ?? "Sedang",
  );
  const [options, setOptions] = useState<string[]>(
    initial?.options?.length ? initial.options : ["", "", "", ""],
  );
  const [correctOption, setCorrectOption] = useState(
    initial?.correctOption ?? 0,
  );
  const [answerKey, setAnswerKey] = useState(initial?.answerKey ?? "");
  const [weight, setWeight] = useState(initial?.weight ?? 1);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const cleanOptions = options.map((option) => option.trim());
    if (!bankId || !text.trim()) {
      setError("Bank soal dan pertanyaan wajib diisi.");
      return;
    }
    if (
      type === "Pilihan Ganda" &&
      (cleanOptions.length < 2 || cleanOptions.some((option) => !option))
    ) {
      setError("Isi minimal dua pilihan jawaban tanpa bagian yang kosong.");
      return;
    }
    if (type === "Essay" && !answerKey.trim()) {
      setError("Kunci atau pedoman jawaban essay wajib diisi.");
      return;
    }
    if (!Number.isFinite(weight) || weight <= 0) {
      setError("Bobot soal harus lebih besar dari 0.");
      return;
    }
    setError("");
    setSaving(true);
    const saved = await save({
      id: initial?.id,
      bankId,
      type,
      text,
      difficulty,
      options: cleanOptions,
      correctOption: type === "Pilihan Ganda" ? correctOption : null,
      answerKey,
      weight,
    });
    if (!saved) setSaving(false);
  };

  const removeOption = (index: number) => {
    setOptions((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
    setCorrectOption((current) =>
      current === index ? 0 : current > index ? current - 1 : current,
    );
  };

  return (
    <Modal close={close} wide>
      <form className="simple-modal question-modal" onSubmit={submit}>
        <header>
          <div>
            <p>BANK SOAL</p>
            <h2>{initial ? "Edit soal" : "Tambah soal baru"}</h2>
          </div>
          <button type="button" onClick={close}>
            <X />
          </button>
        </header>
        <div className="modal-content">
          {error && <p className="question-form-error">{error}</p>}
          <div className="form-grid question-form-grid">
            <FormField label="Bank soal">
              <select
                value={bankId}
                onChange={(event) => setBankId(event.target.value)}
                required
              >
                <option value="">Pilih bank soal</option>
                {banks.map((bank) => (
                  <option value={bank.id} key={bank.id}>
                    {bank.name} — {bank.subject}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Tipe soal">
              <select
                value={type}
                onChange={(event) =>
                  setType(event.target.value as Question["type"])
                }
              >
                <option>Pilihan Ganda</option>
                <option>Essay</option>
              </select>
            </FormField>
            <FormField label="Tingkat kesulitan">
              <select
                value={difficulty}
                onChange={(event) =>
                  setDifficulty(event.target.value as Question["difficulty"])
                }
              >
                <option>Mudah</option>
                <option>Sedang</option>
                <option>Sulit</option>
              </select>
            </FormField>
            <FormField label="Bobot nilai">
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={weight}
                onChange={(event) => setWeight(Number(event.target.value))}
                required
              />
            </FormField>
          </div>
          <FormField label="Pertanyaan">
            <textarea
              rows={4}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Tulis pertanyaan di sini…"
              required
            />
          </FormField>

          {type === "Pilihan Ganda" ? (
            <div className="answer-editor">
              <div className="answer-editor-title">
                <span>Pilihan jawaban</span>
                <small>Pilih radio sebagai jawaban yang benar.</small>
              </div>
              <div className="option-editor">
                {options.map((option, index) => (
                  <label key={index}>
                    <input
                      type="radio"
                      name="correct"
                      checked={correctOption === index}
                      onChange={() => setCorrectOption(index)}
                    />
                    <span>{String.fromCharCode(65 + index)}</span>
                    <input
                      value={option}
                      onChange={(event) =>
                        setOptions((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? event.target.value : item,
                          ),
                        )
                      }
                      placeholder={`Pilihan ${String.fromCharCode(65 + index)}`}
                      required
                    />
                    {options.length > 2 && (
                      <button
                        type="button"
                        title="Hapus pilihan"
                        aria-label="Hapus pilihan"
                        onClick={() => removeOption(index)}
                      >
                        <X />
                      </button>
                    )}
                  </label>
                ))}
              </div>
              {options.length < 6 && (
                <button
                  type="button"
                  className="add-option"
                  onClick={() => setOptions((current) => [...current, ""])}
                >
                  <Plus /> Tambah pilihan
                </button>
              )}
            </div>
          ) : (
            <FormField label="Kunci / pedoman jawaban">
              <textarea
                rows={3}
                value={answerKey}
                onChange={(event) => setAnswerKey(event.target.value)}
                placeholder="Tuliskan poin-poin jawaban yang diharapkan…"
                required
              />
            </FormField>
          )}
        </div>
        <footer>
          <button type="button" onClick={close}>
            Batal
          </button>
          <button className="primary" disabled={saving}>
            {saving
              ? "Menyimpan…"
              : initial
                ? "Simpan Perubahan"
                : "Simpan Soal"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}

function BankModal({
  subjects,
  initial,
  close,
  save,
}: {
  subjects: SubjectOption[];
  initial?: Bank;
  close: () => void;
  save: (draft: BankDraft) => Promise<boolean>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [subjectId, setSubjectId] = useState(
    initial?.subjectId ?? subjects[0]?.id ?? "",
  );
  const [gradeLevel, setGradeLevel] = useState(initial?.gradeLevel ?? "");
  const [saving, setSaving] = useState(false);

  return (
    <Modal close={close}>
      <form
        className="simple-modal"
        onSubmit={async (event) => {
          event.preventDefault();
          setSaving(true);
          const saved = await save({
            id: initial?.id,
            name,
            subjectId,
            gradeLevel,
          });
          if (!saved) setSaving(false);
        }}
      >
        <header>
          <div>
            <p>KOLEKSI SOAL</p>
            <h2>{initial ? "Edit bank soal" : "Buat bank soal"}</h2>
          </div>
          <button type="button" onClick={close}>
            <X />
          </button>
        </header>
        <div className="modal-content">
          <FormField label="Nama bank soal">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Contoh: Aljabar Kelas IX"
              required
            />
          </FormField>
          <div className="form-grid">
            <FormField label="Mata pelajaran">
              <select
                value={subjectId}
                onChange={(event) => setSubjectId(event.target.value)}
                required
              >
                <option value="">Pilih mata pelajaran</option>
                {subjects.map((subject) => (
                  <option value={subject.id} key={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Tingkat kelas">
              <select
                value={gradeLevel}
                onChange={(event) => setGradeLevel(event.target.value)}
                required
              >
                <option value="">Pilih tingkat kelas</option>
                <option value="VII">VII</option>
                <option value="VIII">VIII</option>
                <option value="IX">IX</option>
              </select>
            </FormField>
          </div>
        </div>
        <footer>
          <button type="button" onClick={close}>
            Batal
          </button>
          <button
            className="primary"
            disabled={saving || !name.trim() || !subjectId || !gradeLevel}
          >
            {saving ? "Menyimpan…" : "Simpan Bank"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="form-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Modal({
  children,
  close,
  wide = false,
}: {
  children: ReactNode;
  close: () => void;
  wide?: boolean;
}) {
  return (
    <div className="modal-overlay" onMouseDown={close}>
      <div
        className={`modal ${wide ? "wide" : ""}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
