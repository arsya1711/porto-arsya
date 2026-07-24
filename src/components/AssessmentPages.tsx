import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileQuestion,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import type { ExamStatus } from "../types";
import { deriveExamStatus } from "../lib/exam-status";
import {
  isoToSchoolDateTimeInput,
  schoolDateTimeToIso,
} from "../lib/school-timezone";
import { fetchAllPages } from "../lib/supabase-pagination";

type Notify = (text: string, error?: boolean) => void;

type ExamRow = {
  id: string;
  title: string;
  description: string | null;
  subject_id: string | null;
  class_id: string | null;
  starts_at: string;
  ends_at: string | null;
  duration_minutes: number;
  status: ExamStatus;
  has_access_code: boolean;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  fullscreen_mode: boolean;
  record_tab_switches: boolean;
  subjects: unknown;
  classes: unknown;
  exam_questions: unknown;
  exam_assignments: unknown;
};

type Option = { id: string; name: string };
type QuestionOption = Option & {
  body: string;
  type: "multiple_choice" | "essay";
  bank: string;
  subjectId: string;
};

type ExamDraft = {
  id?: string;
  title: string;
  description: string;
  subjectId: string;
  classId: string;
  startsAt: string;
  duration: number;
  accessCode: string;
  hadAccessCode: boolean;
  removeAccessCode: boolean;
  status: "draft" | "terjadwal";
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  fullscreenMode: boolean;
  recordTabSwitches: boolean;
  questionIds: string[];
};

type GradingItem = {
  answerId: string;
  attemptId: string;
  examId: string;
  studentId: string;
  studentName: string;
  examTitle: string;
  className: string;
  questionId: string;
  question: string;
  answerKey: string;
  essayText: string;
  weight: number;
  score: number | null;
  comment: string;
  submittedAt: string | null;
};

type ReportAttempt = {
  id: string;
  examId: string;
  examTitle: string;
  className: string;
  studentName: string;
  status: string;
  score: number | null;
  submittedAt: string | null;
};

type AnalysisItem = {
  questionId: string;
  body: string;
  type: "multiple_choice" | "essay";
  difficulty: string;
  answered: number;
  value: number;
};

function relationName(value: unknown, fallback = "—") {
  if (Array.isArray(value)) return String(value[0]?.name ?? fallback);
  if (value && typeof value === "object" && "name" in value) {
    return String(value.name ?? fallback);
  }
  return fallback;
}

function relationCount(value: unknown) {
  return Array.isArray(value) ? Number(value[0]?.count ?? 0) : 0;
}

function nestedRecord(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) return (value[0] ?? {}) as Record<string, unknown>;
  return (value ?? {}) as Record<string, unknown>;
}

function formatDate(value: string | null, timeZone?: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}

function currentExamStatus(exam: ExamRow) {
  return deriveExamStatus(
    exam.status,
    exam.starts_at,
    exam.ends_at,
    exam.duration_minutes,
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <p>{eyebrow}</p>
        <h1>{title}</h1>
        <span>{description}</span>
      </div>
      {action}
    </div>
  );
}

function PageState({
  loading,
  error,
  empty,
  onRetry,
  action,
}: {
  loading: boolean;
  error: string;
  empty: string;
  onRetry?: () => void;
  action?: ReactNode;
}) {
  return (
    <div className="real-empty-state">
      {loading ? <LoaderCircle className="spin" /> : error ? <AlertTriangle /> : <FileQuestion />}
      <h3>{loading ? "Memuat data…" : error ? "Data belum dapat dimuat" : "Belum ada data"}</h3>
      <p>{loading ? "Mengambil data terbaru dari Supabase." : error || empty}</p>
      {error && onRetry && (
        <button type="button" onClick={onRetry}>
          <RefreshCw /> Coba lagi
        </button>
      )}
      {!loading && !error && action}
    </div>
  );
}

export function RealExamManagement({
  notify,
}: {
  notify: Notify;
}) {
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [subjects, setSubjects] = useState<Option[]>([]);
  const [classes, setClasses] = useState<Option[]>([]);
  const [questions, setQuestions] = useState<QuestionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<ExamDraft | null>(null);
  const [examStep, setExamStep] = useState<0 | 1 | 2>(0);
  const [saving, setSaving] = useState(false);
  const [securityDefaults, setSecurityDefaults] = useState({ fullscreen: true, recordTabs: true });
  const [schoolTimezone, setSchoolTimezone] = useState("Asia/Jakarta");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    const client = supabase;
    if (!client) {
      setError("Supabase belum dikonfigurasi. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const [examResult, subjectResult, classResult, questionResult, settingsResult] = await Promise.all([
      fetchAllPages((from, to) =>
        client
          .from("exams")
          .select("id,title,description,subject_id,class_id,starts_at,ends_at,duration_minutes,status,has_access_code,shuffle_questions,shuffle_options,fullscreen_mode,record_tab_switches,subjects(name),classes(name),exam_questions(count),exam_assignments(count)")
          .order("starts_at", { ascending: false })
          .range(from, to),
      ),
      client.from("subjects").select("id,name").order("name"),
      client.from("classes").select("id,name").order("name"),
      fetchAllPages((from, to) =>
        client
          .from("questions")
          .select("id,body,type,question_banks(name,subject_id)")
          .eq("archived", false)
          .order("created_at", { ascending: false })
          .range(from, to),
      ),
      client.from("school_profile_settings").select("require_fullscreen_default,record_tab_switches,school_timezone").eq("id", 1).maybeSingle(),
    ]);
    const requestError = examResult.error ?? subjectResult.error ?? classResult.error ?? questionResult.error;
    if (requestError) {
      setError(requestError.message);
    } else {
      setExams((examResult.data ?? []) as unknown as ExamRow[]);
      setSubjects((subjectResult.data ?? []) as Option[]);
      setClasses((classResult.data ?? []) as Option[]);
      setQuestions(
        (questionResult.data ?? []).map((row) => {
          const bank = nestedRecord(row.question_banks);
          return {
            id: row.id,
            name: row.body,
            body: row.body,
            type: row.type,
            bank: String(bank.name ?? "Tanpa bank"),
            subjectId: String(bank.subject_id ?? ""),
          };
        }),
      );
      if (settingsResult.data) {
        setSecurityDefaults({ fullscreen: settingsResult.data.require_fullscreen_default ?? true, recordTabs: settingsResult.data.record_tab_switches ?? true });
        setSchoolTimezone(settingsResult.data.school_timezone ?? "Asia/Jakarta");
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleExams = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return exams;
    return exams.filter((exam) =>
      [
        exam.title,
        relationName(exam.subjects),
        relationName(exam.classes),
        currentExamStatus(exam),
      ]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [exams, search]);
  const pageSize = 25;
  const pageCount = Math.max(1, Math.ceil(visibleExams.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pagedExams = visibleExams.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  useEffect(() => setPage(1), [search]);

  const openCreate = () => {
    setExamStep(0);
    setDraft({
      title: "",
      description: "",
      subjectId: subjects[0]?.id ?? "",
      classId: classes[0]?.id ?? "",
      startsAt: isoToSchoolDateTimeInput(null, schoolTimezone),
      duration: 90,
      accessCode: "",
      hadAccessCode: false,
      removeAccessCode: false,
      status: "draft",
      shuffleQuestions: true,
      shuffleOptions: true,
      fullscreenMode: securityDefaults.fullscreen,
      recordTabSwitches: securityDefaults.recordTabs,
      questionIds: [],
    });
  };

  const openEdit = async (exam: ExamRow) => {
    if (!supabase) return;
    const { data, error: questionError } = await supabase
      .from("exam_questions")
      .select("question_id")
      .eq("exam_id", exam.id)
      .order("position");
    if (questionError) {
      notify(questionError.message, true);
      return;
    }
    setExamStep(0);
    setDraft({
      id: exam.id,
      title: exam.title,
      description: exam.description ?? "",
      subjectId: exam.subject_id ?? "",
      classId: exam.class_id ?? "",
      startsAt: isoToSchoolDateTimeInput(exam.starts_at, schoolTimezone),
      duration: exam.duration_minutes,
      accessCode: "",
      hadAccessCode: exam.has_access_code,
      removeAccessCode: false,
      status: exam.status === "draft" ? "draft" : "terjadwal",
      shuffleQuestions: exam.shuffle_questions,
      shuffleOptions: exam.shuffle_options,
      fullscreenMode: exam.fullscreen_mode,
      recordTabSwitches: exam.record_tab_switches,
      questionIds: (data ?? []).map((item) => item.question_id),
    });
  };

  const saveExam = async () => {
    if (!supabase || !draft) return;
    if (!draft.title.trim() || !draft.subjectId || !draft.classId || !draft.questionIds.length) {
      notify("Lengkapi judul, mata pelajaran, kelas, dan pilih minimal satu soal.", true);
      return;
    }
    if (draft.accessCode.trim() && draft.accessCode.trim().length < 4) {
      notify("Kode akses minimal terdiri dari 4 karakter.", true);
      return;
    }
    setSaving(true);
    const startsAt = schoolDateTimeToIso(draft.startsAt, schoolTimezone);
    if (!startsAt) {
      setSaving(false);
      notify("Tanggal dan waktu mulai tidak valid.", true);
      return;
    }
    const { error: saveError } = await supabase.rpc("save_managed_exam", {
      target_exam_id: draft.id ?? null,
      exam_title: draft.title.trim(),
      exam_description: draft.description.trim() || null,
      target_subject_id: draft.subjectId,
      target_class_id: draft.classId,
      start_time: startsAt,
      duration_in_minutes: draft.duration,
      target_status: draft.status,
      question_ids: draft.questionIds,
      access_code_value: draft.removeAccessCode
        ? "__REMOVE__"
        : draft.accessCode.trim() || (draft.hadAccessCode ? "__KEEP__" : null),
      should_shuffle_questions: draft.shuffleQuestions,
      should_shuffle_options: draft.shuffleOptions,
      should_use_fullscreen: draft.fullscreenMode,
      should_record_tab_switches: draft.recordTabSwitches,
    });
    setSaving(false);
    if (saveError) {
      notify(saveError.message, true);
      return;
    }
    setDraft(null);
    notify(draft.id ? "Ujian berhasil diperbarui." : "Ujian berhasil dibuat dan peserta kelas telah ditetapkan.");
    await load();
  };

  const removeExam = async (exam: ExamRow) => {
    if (!supabase || !window.confirm(`Hapus ujian “${exam.title}”? Semua penugasan ujian ikut terhapus.`)) return;
    const { error: deleteError } = await supabase.rpc("delete_managed_exam", {
      target_exam_id: exam.id,
    });
    if (deleteError) notify(deleteError.message, true);
    else {
      notify("Ujian berhasil dihapus.");
      await load();
    }
  };

  const filteredQuestions = questions.filter((question) => {
    if (!draft?.subjectId) return true;
    return question.subjectId === draft.subjectId;
  });

  const toggleQuestion = (questionId: string, checked: boolean) => {
    setDraft((currentDraft) => {
      if (!currentDraft) return currentDraft;
      const questionIds = new Set(currentDraft.questionIds);
      if (checked) questionIds.add(questionId);
      else questionIds.delete(questionId);
      return { ...currentDraft, questionIds: [...questionIds] };
    });
  };

  const nextExamStep = () => {
    if (!draft) return;
    if (examStep === 0) {
      if (!draft.title.trim() || !draft.subjectId || !draft.classId) {
        notify("Lengkapi judul, mata pelajaran, dan kelas peserta.", true);
        return;
      }
      if (!draft.startsAt || !schoolDateTimeToIso(draft.startsAt, schoolTimezone) || draft.duration < 1) {
        notify("Periksa kembali jadwal mulai dan durasi ujian.", true);
        return;
      }
    }
    if (examStep === 1 && !draft.questionIds.length) {
      notify("Pilih minimal satu soal sebelum melanjutkan.", true);
      return;
    }
    setExamStep((current) => Math.min(2, current + 1) as 0 | 1 | 2);
  };

  const closeExamModal = () => {
    if (saving) return;
    setDraft(null);
    setExamStep(0);
  };

  const selectedSubjectName = subjects.find((item) => item.id === draft?.subjectId)?.name ?? "Belum dipilih";
  const selectedClassName = classes.find((item) => item.id === draft?.classId)?.name ?? "Belum dipilih";
  const examStepTitles = ["Informasi dasar", "Pilih soal", "Keamanan & publikasi"];

  return (
    <div className="portal-page">
      <PageHeader
        eyebrow="MANAJEMEN UJIAN"
        title="Daftar Ujian"
        description="Susun soal, jadwalkan ujian, dan tetapkan peserta berdasarkan kelas."
        action={
          <button className="primary" type="button" onClick={openCreate} disabled={!subjects.length || !classes.length}>
            <Plus /> Buat ujian
          </button>
        }
      />
      <div className="toolbar real-toolbar">
        <div>
          <Search />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari ujian, kelas, atau status…" />
        </div>
        <button type="button" onClick={() => void load()}><RefreshCw /> Muat ulang</button>
      </div>
      {loading || error || !visibleExams.length ? (
        <PageState
          loading={loading}
          error={error}
          empty={search ? "Tidak ada ujian yang sesuai dengan pencarian." : "Belum ada ujian. Buat ujian pertama dari bank soal yang tersedia."}
          onRetry={() => void load()}
          action={!search && subjects.length && classes.length ? <button type="button" className="primary" onClick={openCreate}><Plus /> Buat ujian pertama</button> : undefined}
        />
      ) : (
        <div className="table-card exam-management-table responsive-card-table">
          <table>
            <thead><tr><th>UJIAN</th><th>KELAS</th><th>JADWAL</th><th>PESERTA</th><th>STATUS</th><th>AKSI</th></tr></thead>
            <tbody>
              {pagedExams.map((exam) => (
                <tr key={exam.id}>
                  <td data-label="Ujian"><div className="exam-cell"><span>{relationName(exam.subjects, "UJ").slice(0, 2).toUpperCase()}</span><p><b>{exam.title}</b><small>{relationName(exam.subjects)} · {relationCount(exam.exam_questions)} soal</small></p></div></td>
                  <td data-label="Kelas">{relationName(exam.classes)}</td>
                  <td data-label="Jadwal"><b className="table-main">{formatDate(exam.starts_at, schoolTimezone)}</b><small>{exam.duration_minutes} menit · {schoolTimezone}</small></td>
                  <td data-label="Peserta"><div className="participant"><Users /> <span>{relationCount(exam.exam_assignments)} siswa</span></div></td>
                  <td data-label="Status">
                    {(() => {
                      const status = currentExamStatus(exam);
                      return (
                        <span className={`status ${status}`}>
                          <i />
                          {status[0].toUpperCase() + status.slice(1)}
                        </span>
                      );
                    })()}
                  </td>
                  <td data-label="Aksi"><div className="row-actions"><button type="button" title="Edit ujian" onClick={() => void openEdit(exam)}><Pencil /></button><button type="button" className="danger" title="Hapus ujian" onClick={() => void removeExam(exam)}><Trash2 /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="table-footer"><span>Menampilkan {pagedExams.length} dari {visibleExams.length} ujian</span></div>
          {visibleExams.length > pageSize && (
            <nav className="pagination-controls" aria-label="Halaman daftar ujian">
              <span>Halaman {safePage} dari {pageCount}</span>
              <div>
                <button type="button" disabled={safePage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Sebelumnya</button>
                <button type="button" disabled={safePage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>Berikutnya</button>
              </div>
            </nav>
          )}
        </div>
      )}
      {draft && (
        <div className="modal-overlay">
          <div className="modal wide" role="dialog" aria-modal="true">
            <div className="simple-modal real-exam-modal">
              <header>
                <div>
                  <p>{draft.id ? "EDIT UJIAN" : "UJIAN BARU"} · LANGKAH {examStep + 1} DARI 3</p>
                  <h2>{examStepTitles[examStep]}</h2>
                </div>
                <button type="button" aria-label="Tutup formulir ujian" onClick={closeExamModal}><X /></button>
              </header>
              <div className="exam-modal-progress" aria-label={`Langkah ${examStep + 1} dari 3`}>
                {examStepTitles.map((title, index) => (
                  <span key={title} aria-current={index === examStep ? "step" : undefined} className={index === examStep ? "active" : index < examStep ? "done" : ""}>
                    <i>{index < examStep ? <CheckCircle2 /> : index + 1}</i>
                    <b>{title}</b>
                  </span>
                ))}
              </div>
              <div className="modal-content">
                {examStep === 0 && (
                  <div className="exam-step">
                    <p className="exam-step-intro">Tentukan identitas, peserta, dan waktu pelaksanaan ujian.</p>
                    <label className="form-field"><span>Judul ujian</span><input autoFocus value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Contoh: Penilaian Tengah Semester" /></label>
                    <label className="form-field"><span>Deskripsi (opsional)</span><textarea rows={2} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Tambahkan petunjuk singkat untuk peserta." /></label>
                    <div className="form-grid">
                      <label className="form-field"><span>Mata pelajaran</span><select value={draft.subjectId} onChange={(event) => setDraft({ ...draft, subjectId: event.target.value, questionIds: [] })}>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
                      <label className="form-field"><span>Kelas peserta</span><select value={draft.classId} onChange={(event) => setDraft({ ...draft, classId: event.target.value })}>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                      <label className="form-field"><span>Mulai <small>(zona waktu sekolah: {schoolTimezone})</small></span><input type="datetime-local" value={draft.startsAt} onChange={(event) => setDraft({ ...draft, startsAt: event.target.value })} /></label>
                      <label className="form-field"><span>Durasi (menit)</span><input type="number" min={1} value={draft.duration} onChange={(event) => setDraft({ ...draft, duration: Math.max(1, Number(event.target.value)) })} /></label>
                      <label className="form-field"><span>Status awal</span><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as ExamDraft["status"] })}><option value="draft">Simpan sebagai draft</option><option value="terjadwal">Jadwalkan untuk peserta</option></select></label>
                    </div>
                  </div>
                )}
                {examStep === 1 && (
                  <div className="exam-step">
                    <p className="exam-step-intro">Menampilkan soal <b>{selectedSubjectName}</b>. Pilih minimal satu soal untuk ujian ini.</p>
                    <div className="real-question-picker">
                      <div><b>Daftar soal</b><span>{draft.questionIds.length} dipilih</span></div>
                      {!filteredQuestions.length ? <p>Belum ada soal pada bank soal mata pelajaran ini. Tutup formulir, lalu tambahkan soal terlebih dahulu.</p> : filteredQuestions.map((question) => (
                        <label key={question.id}>
                          <input type="checkbox" checked={draft.questionIds.includes(question.id)} onChange={(event) => toggleQuestion(question.id, event.target.checked)} />
                          <span><b>{question.body}</b><small>{question.bank} · {question.type === "essay" ? "Essay" : "Pilihan Ganda"}</small></span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {examStep === 2 && (
                  <div className="exam-step">
                    <div className="exam-review" aria-label="Ringkasan ujian">
                      <div><small>Mata pelajaran</small><b>{selectedSubjectName}</b></div>
                      <div><small>Kelas</small><b>{selectedClassName}</b></div>
                      <div><small>Isi ujian</small><b>{draft.questionIds.length} soal · {draft.duration} menit</b></div>
                    </div>
                    <label className="form-field"><span>{draft.hadAccessCode ? "Kode akses baru (kosong = pertahankan)" : "Kode akses (opsional)"}</span><input value={draft.accessCode} disabled={draft.removeAccessCode} minLength={4} maxLength={64} autoComplete="off" placeholder="Minimal 4 karakter" onChange={(event) => setDraft({ ...draft, accessCode: event.target.value.toUpperCase(), removeAccessCode: false })} /></label>
                    {draft.hadAccessCode && <label className="real-remove-access-code"><input type="checkbox" checked={draft.removeAccessCode} onChange={(event) => setDraft({ ...draft, removeAccessCode: event.target.checked, accessCode: "" })} /> Hapus kode akses yang tersimpan</label>}
                    <div className="switch-list real-switches">
                      <label><span><b>Acak urutan soal</b><small>Urutan soal dapat berbeda untuk setiap siswa.</small></span><input type="checkbox" checked={draft.shuffleQuestions} onChange={(event) => setDraft({ ...draft, shuffleQuestions: event.target.checked })} /></label>
                      <label><span><b>Acak pilihan jawaban</b><small>Acak opsi pada soal pilihan ganda.</small></span><input type="checkbox" checked={draft.shuffleOptions} onChange={(event) => setDraft({ ...draft, shuffleOptions: event.target.checked })} /></label>
                      <label><span><b>Wajibkan layar penuh</b><small>Minta siswa menjalankan ujian dalam mode layar penuh.</small></span><input type="checkbox" checked={draft.fullscreenMode} onChange={(event) => setDraft({ ...draft, fullscreenMode: event.target.checked })} /></label>
                      <label><span><b>Catat perpindahan tab</b><small>Simpan kejadian ketika siswa meninggalkan halaman ujian.</small></span><input type="checkbox" checked={draft.recordTabSwitches} onChange={(event) => setDraft({ ...draft, recordTabSwitches: event.target.checked })} /></label>
                    </div>
                  </div>
                )}
              </div>
              <footer>
                <button type="button" onClick={examStep === 0 ? closeExamModal : () => setExamStep((examStep - 1) as 0 | 1 | 2)}>{examStep === 0 ? "Batal" : "Kembali"}</button>
                {examStep < 2 ? (
                  <button type="button" className="primary" onClick={nextExamStep}>Lanjut</button>
                ) : (
                  <button type="button" className="primary" disabled={saving} onClick={() => void saveExam()}>{saving ? "Menyimpan…" : draft.status === "draft" ? "Simpan draft" : "Jadwalkan ujian"}</button>
                )}
              </footer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function RealGrading({ notify }: { notify: Notify }) {
  const [items, setItems] = useState<GradingItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [score, setScore] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) {
      setError("Supabase belum dikonfigurasi.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const { data, error: loadError } = await supabase
      .from("answers")
      .select("id,attempt_id,question_id,essay_text,score,teacher_comment,answered_at,questions!inner(id,body,answer_key,weight,type),attempts!inner(id,status,student_id,exam_id,submitted_at)")
      .eq("questions.type", "essay")
      .order("answered_at");
    if (loadError) {
      setError(loadError.message);
      setLoading(false);
      return;
    }
    const baseRows = (data ?? []).map((row) => {
      const question = nestedRecord(row.questions);
      const attempt = nestedRecord(row.attempts);
      return { row, question, attempt };
    }).filter(({ attempt }) => ["submitted", "grading", "final"].includes(String(attempt.status)));
    const studentIds = [...new Set(baseRows.map(({ attempt }) => String(attempt.student_id)))];
    const examIds = [...new Set(baseRows.map(({ attempt }) => String(attempt.exam_id)))];
    const [profileResult, examResult] = await Promise.all([
      studentIds.length ? supabase.from("profiles").select("id,full_name").in("id", studentIds) : Promise.resolve({ data: [], error: null }),
      examIds.length ? supabase.from("exams").select("id,title,classes(name)").in("id", examIds) : Promise.resolve({ data: [], error: null }),
    ]);
    const secondaryError = profileResult.error ?? examResult.error;
    if (secondaryError) {
      setError(secondaryError.message);
      setLoading(false);
      return;
    }
    const profiles = new Map((profileResult.data ?? []).map((row) => [row.id, row.full_name]));
    const exams = new Map((examResult.data ?? []).map((row) => [row.id, { title: row.title, className: relationName(row.classes) }]));
    const normalized: GradingItem[] = baseRows.map(({ row, question, attempt }) => {
      const exam = exams.get(String(attempt.exam_id));
      return {
        answerId: row.id,
        attemptId: row.attempt_id,
        examId: String(attempt.exam_id),
        studentId: String(attempt.student_id),
        studentName: profiles.get(String(attempt.student_id)) ?? "Siswa",
        examTitle: exam?.title ?? "Ujian",
        className: exam?.className ?? "—",
        questionId: row.question_id,
        question: String(question.body ?? ""),
        answerKey: String(question.answer_key ?? "Belum ada kunci jawaban."),
        essayText: row.essay_text ?? "",
        weight: Number(question.weight ?? 1),
        score: row.score === null ? null : Number(row.score),
        comment: row.teacher_comment ?? "",
        submittedAt: String(attempt.submitted_at ?? row.answered_at ?? "") || null,
      };
    });
    normalized.sort((a, b) => Number(a.score !== null) - Number(b.score !== null));
    setItems(normalized);
    setSelectedId((current) => current && normalized.some((item) => item.answerId === current) ? current : normalized[0]?.answerId ?? "");
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  const selected = items.find((item) => item.answerId === selectedId) ?? null;
  useEffect(() => {
    setScore(selected?.score === null || selected?.score === undefined ? "" : String(selected.score));
    setComment(selected?.comment ?? "");
  }, [selected]);

  const save = async () => {
    if (!supabase || !selected) return;
    const numericScore = Number(score);
    if (!Number.isFinite(numericScore) || numericScore < 0 || numericScore > selected.weight) {
      notify(`Skor harus berada di antara 0 dan ${selected.weight}.`, true);
      return;
    }
    setSaving(true);
    const { error: saveError } = await supabase.rpc("grade_essay_answer", {
      target_answer_id: selected.answerId,
      awarded_score: numericScore,
      feedback: comment.trim() || null,
    });
    if (saveError) {
      setSaving(false);
      notify(saveError.message, true);
      return;
    }
    setSaving(false);
    notify("Nilai essay berhasil disimpan.");
    await load();
  };

  const graded = items.filter((item) => item.score !== null).length;
  return (
    <div className="portal-page">
      <PageHeader eyebrow="PENILAIAN" title="Koreksi Essay" description="Jawaban yang dikumpulkan siswa tampil otomatis untuk dinilai." />
      {loading || error || !selected ? (
        <PageState loading={loading} error={error} empty="Belum ada jawaban essay yang menunggu koreksi." onRetry={() => void load()} />
      ) : (
        <div className="grading-shell">
          <aside>
            <div className="grading-progress"><p><b>{graded} dari {items.length} dinilai</b><span>{Math.round((graded / items.length) * 100)}%</span></p><i><span style={{ width: `${(graded / items.length) * 100}%` }} /></i></div>
            <div className="student-answer-list">
              {items.map((item) => <button type="button" key={item.answerId} className={selectedId === item.answerId ? "active" : ""} onClick={() => setSelectedId(item.answerId)}><span>{initials(item.studentName)}</span><p><b>{item.studentName}</b><small>{item.score === null ? "Belum dinilai" : `Skor ${item.score}/${item.weight}`}</small></p>{item.score !== null ? <CheckCircle2 /> : null}</button>)}
            </div>
          </aside>
          <main className="grading-main">
            <div className="question-reference"><small>{selected.examTitle.toUpperCase()} · BOBOT {selected.weight} POIN</small><h3>{selected.question}</h3><details><summary>Lihat kunci jawaban</summary><p>{selected.answerKey}</p></details></div>
            <div className="answer-paper"><div><span className="avatar sm">{initials(selected.studentName)}</span><p><b>{selected.studentName}</b><small>{selected.className} · Dikumpulkan {formatDate(selected.submittedAt)}</small></p></div><p>{selected.essayText || "Siswa tidak memberikan jawaban."}</p></div>
            <div className="score-panel">
              <label className="form-field"><span>Skor (maks. {selected.weight})</span><input type="number" min={0} max={selected.weight} step="0.5" value={score} onChange={(event) => setScore(event.target.value)} /></label>
              <label className="form-field"><span>Komentar untuk siswa</span><input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Berikan umpan balik singkat…" /></label>
              <button type="button" className="primary" disabled={saving} onClick={() => void save()}>{saving ? "Menyimpan…" : "Simpan nilai"}</button>
            </div>
          </main>
        </div>
      )}
    </div>
  );
}

export function RealReports() {
  const [attempts, setAttempts] = useState<ReportAttempt[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisItem[]>([]);
  const [selectedExam, setSelectedExam] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [passingScore, setPassingScore] = useState(75);

  const loadAttempts = useCallback(async () => {
    if (!supabase) {
      setError("Supabase belum dikonfigurasi.");
      setLoading(false);
      return;
    }
    setLoading(true);
    const [attemptResult, settingsResult] = await Promise.all([
      supabase.from("attempts").select("id,exam_id,student_id,status,final_score,objective_score,essay_score,submitted_at,exams(title,classes(name)),profiles(full_name)").in("status", ["submitted", "grading", "final"]).order("submitted_at", { ascending: false }),
      supabase.from("school_profile_settings").select("passing_score").eq("id", 1).maybeSingle(),
    ]);
    const data = attemptResult.data;
    const loadError = attemptResult.error ?? settingsResult.error;
    if (loadError) {
      setError(loadError.message);
      setLoading(false);
      return;
    }
    const normalized: ReportAttempt[] = (data ?? []).map((row) => {
      const exam = nestedRecord(row.exams);
      return { id: row.id, examId: row.exam_id, examTitle: String(exam.title ?? "Ujian"), className: relationName(exam.classes), studentName: relationName(row.profiles, "Siswa"), status: row.status, score: row.final_score === null ? null : Number(row.final_score), submittedAt: row.submitted_at };
    });
    setAttempts(normalized);
    setPassingScore(Number(settingsResult.data?.passing_score ?? 75));
    setSelectedExam((current) => current && normalized.some((item) => item.examId === current) ? current : normalized[0]?.examId ?? "");
    setError("");
    setLoading(false);
  }, []);

  useEffect(() => { void loadAttempts(); }, [loadAttempts]);

  useEffect(() => {
    if (!supabase || !selectedExam) { setAnalysis([]); return; }
    let active = true;
    supabase.from("answers").select("question_id,selected_option,score,questions(body,type,correct_option,weight,difficulty),attempts!inner(exam_id,status)").eq("attempts.exam_id", selectedExam).in("attempts.status", ["submitted", "grading", "final"]).then(({ data, error: analysisError }) => {
      if (!active) return;
      if (analysisError) {
        setError(analysisError.message);
        setAnalysis([]);
        return;
      }
      const grouped = new Map<string, { body: string; type: "multiple_choice" | "essay"; difficulty: string; answered: number; sum: number }>();
      for (const row of data ?? []) {
        const question = nestedRecord(row.questions);
        const id = row.question_id;
        const type = String(question.type) as "multiple_choice" | "essay";
        const current = grouped.get(id) ?? { body: String(question.body ?? "Soal"), type, difficulty: String(question.difficulty ?? "sedang"), answered: 0, sum: 0 };
        current.answered += 1;
        current.sum += type === "multiple_choice" ? Number(row.selected_option === question.correct_option) : Number(row.score ?? 0) / Math.max(1, Number(question.weight ?? 1));
        grouped.set(id, current);
      }
      setAnalysis([...grouped.entries()].map(([questionId, item]) => ({ questionId, body: item.body, type: item.type, difficulty: item.difficulty, answered: item.answered, value: item.answered ? Math.round((item.sum / item.answered) * 100) : 0 })));
    });
    return () => { active = false; };
  }, [selectedExam]);

  const examOptions = useMemo(() => [...new Map(attempts.map((item) => [item.examId, item.examTitle])).entries()], [attempts]);
  const rows = attempts.filter((item) => item.examId === selectedExam);
  const scores = rows.flatMap((item) => item.score === null ? [] : [item.score]);
  const average = scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : 0;
  const passed = scores.filter((value) => value >= passingScore).length;
  const pending = rows.filter((item) => item.score === null).length;
  const distribution = Array.from({ length: 10 }, (_, index) => scores.filter((score) => score >= index * 10 && (index === 9 ? score <= 100 : score < (index + 1) * 10)).length);
  const maxDistribution = Math.max(1, ...distribution);

  const exportCsv = () => {
    const header = ["Nama siswa", "Ujian", "Kelas", "Status", "Nilai", "Dikumpulkan"];
    const csv = [header, ...rows.map((item) => [item.studentName, item.examTitle, item.className, item.status, item.score ?? "Belum final", formatDate(item.submittedAt)])]
      .map((columns) => columns.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `laporan-${selectedExam}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="portal-page">
      <PageHeader eyebrow="LAPORAN & ANALITIK" title="Hasil Ujian" description="Ringkasan nilai dihitung dari jawaban dan percobaan ujian yang tersimpan." action={<button type="button" className="outline" onClick={exportCsv} disabled={!rows.length}><Download /> Ekspor CSV</button>} />
      {loading || error || !attempts.length ? <PageState loading={loading} error={error} empty="Belum ada ujian yang dikumpulkan siswa." onRetry={() => void loadAttempts()} /> : <>
        <div className="report-filter">
          <label>
            <span>Pilih ujian yang dianalisis</span>
            <select value={selectedExam} onChange={(event) => setSelectedExam(event.target.value)}>{examOptions.map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select>
          </label>
          <button type="button" onClick={() => void loadAttempts()}><RefreshCw /> Muat ulang</button>
        </div>
        <div className="report-stats">
          <div><small>RATA-RATA</small><b>{scores.length ? average.toLocaleString("id-ID", { maximumFractionDigits: 1 }) : "—"}</b><span>{scores.length} nilai final</span></div>
          <div><small>NILAI TERTINGGI</small><b>{scores.length ? Math.max(...scores) : "—"}</b><span>{scores.length ? rows.find((item) => item.score === Math.max(...scores))?.studentName : "Belum ada"}</span></div>
          <div><small>KETUNTASAN (KKM {passingScore})</small><b>{scores.length ? `${Math.round((passed / scores.length) * 100)}%` : "—"}</b><span>{passed} dari {scores.length} siswa</span></div>
          <div><small>MENUNGGU KOREKSI</small><b>{pending}</b><span>jawaban belum final</span></div>
        </div>
        <div className="report-grid">
          <section className="card chart-card"><div className="card-head"><h3>Distribusi nilai</h3></div><div className="grade-chart">{distribution.map((count, index) => <div key={index}><i style={{ height: `${Math.max(3, (count / maxDistribution) * 100)}%` }} title={`${count} siswa`} /><span>{index * 10}</span></div>)}</div></section>
          <section className="card"><div className="card-head"><h3>Ringkasan peserta</h3></div><div className="real-report-summary"><span><ClipboardCheck /></span><strong>{rows.length}</strong><p>jawaban dikumpulkan</p><ul><li><i className="green" />Lulus KKM <b>{passed}</b></li><li><i className="amber" />Di bawah KKM <b>{scores.length - passed}</b></li><li><i className="gray" />Belum final <b>{pending}</b></li></ul></div></section>
        </div>
        <section className="card item-analysis"><div className="card-head"><h3>Analisis butir soal</h3></div>{!analysis.length ? <div className="inline-empty">Belum ada jawaban yang dapat dianalisis.</div> : analysis.map((item, index) => <div className="analysis-row" key={item.questionId}><span>{String(index + 1).padStart(2, "0")}</span><p><b>{item.body}</b><small>{item.type === "essay" ? "Essay · rata-rata skor" : "Pilihan Ganda · dijawab benar"}</small></p><div><small>{item.answered} JAWABAN</small><b>{item.value}%</b></div><span className={`difficulty ${item.difficulty}`}>{item.difficulty}</span></div>)}</section>
      </>}
    </div>
  );
}
