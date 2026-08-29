import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Clock3,
  ClipboardCheck,
  ClipboardList,
  Download,
  Eye,
  FileQuestion,
  LoaderCircle,
  Pause,
  Pencil,
  Play,
  Plus,
  Radio,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Trash2,
  Users,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { encodeCsv } from "../lib/csv";
import type { ExamStatus, RubricCriterion } from "../types";
import { deriveExamStatus } from "../lib/exam-status";
import {
  addMinutesToSchoolDateTimeInput,
  isoToSchoolDateTimeInput,
  schoolDateTimeRangeMinutes,
  schoolDateTimeToIso,
} from "../lib/school-timezone";
import { fetchAllPages } from "../lib/supabase-pagination";
import { useAccessibleDialog } from "../lib/use-accessible-dialog";
import {
  isValidExamDuration,
} from "../lib/exam-duration";

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
type AssignmentPair = { class_id: string; subject_id: string };
type QuestionOption = Option & {
  body: string;
  type: "multiple_choice" | "essay";
  bank: string;
  subjectId: string;
};

type QuestionUsage = {
  examId: string;
  examTitle: string;
  className: string;
  startsAt: string;
};

type ExamDraft = {
  id?: string;
  title: string;
  description: string;
  subjectId: string;
  classId: string;
  startsAt: string;
  endsAt: string;
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
  rubric: RubricCriterion[];
  rubricScores: number[];
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

type ExamAttemptSummary = {
  completed: number;
  inProgress: number;
};

type ExamQuestionPreview = {
  id: string;
  position: number;
  body: string;
  type: "multiple_choice" | "essay";
  options: string[];
};

type ExamStudentResult = {
  id: string;
  studentName: string;
  status: string;
  score: number | null;
  submittedAt: string | null;
  answers: StudentAnswerReview[];
};

type ExamMonitorRow = {
  studentId: string;
  studentName: string;
  attemptId: string | null;
  status: string;
  startedAt: string | null;
  submittedAt: string | null;
  isPaused: boolean;
  isOnline: boolean;
  lastSeenAt: string | null;
  extraTimeMinutes: number;
  answeredCount: number;
  exitCount: number;
};

type IntegrityTimelineItem = {
  id: string;
  type: string;
  occurredAt: string;
  metadata: Record<string, unknown>;
};

type StudentAnswerReview = {
  id: string;
  questionId: string;
  position: number;
  body: string;
  type: "multiple_choice" | "essay";
  options: string[];
  selectedOption: number | null;
  essayText: string;
  score: number | null;
  comment: string;
  answerKey: string;
  correctOption: number | null;
  weight: number;
  rubric: RubricCriterion[];
  rubricScores: number[];
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

function QuestionUsageNotice({
  usages,
  currentExamId,
}: {
  usages: QuestionUsage[];
  currentExamId?: string;
}) {
  if (!usages.length) return null;

  return (
    <span className="question-usage-note" role="note">
      <CheckCircle2 />
      <span>
        <strong>Sudah dipakai di {usages.length} ujian</strong>
        <span className="question-usage-locations">
          {usages.map((usage) => (
            <span className="question-usage-location" key={usage.examId}>
              {usage.examTitle} · {usage.className}
              {usage.examId === currentExamId ? " · Ujian ini" : ""}
            </span>
          ))}
        </span>
      </span>
    </span>
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

function normalizeRubricCriteria(value: unknown, fallbackWeight: number): RubricCriterion[] {
  if (!Array.isArray(value)) return [{ label: "Penilaian keseluruhan", points: fallbackWeight }];
  const criteria = value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const label = String(record.label ?? "").trim();
    const points = Number(record.points);
    return label && Number.isFinite(points) && points > 0 ? [{ label, points }] : [];
  });
  return criteria.length ? criteria : [{ label: "Penilaian keseluruhan", points: fallbackWeight }];
}

function normalizeRubricScores(value: unknown, rubric: RubricCriterion[], totalScore: number | null) {
  if (Array.isArray(value) && value.length === rubric.length) {
    return value.map((item) => Number((item as Record<string, unknown>)?.score ?? 0));
  }
  if (rubric.length === 1 && totalScore !== null) return [totalScore];
  return rubric.map(() => 0);
}

function RubricScoreEditor({
  rubric,
  scores,
  onChange,
}: {
  rubric: RubricCriterion[];
  scores: number[];
  onChange: (scores: number[]) => void;
}) {
  const total = rubric.reduce((sum, criterion, index) => sum + Number(scores[index] ?? 0), 0);
  const maximum = rubric.reduce((sum, criterion) => sum + criterion.points, 0);

  return (
    <div className="essay-rubric-scoring">
      <div className="essay-rubric-scoring-head">
        <b>Rubrik penilaian</b>
        <span>Total {total}/{maximum}</span>
      </div>
      {rubric.map((criterion, index) => (
        <label key={`${criterion.label}-${index}`}>
          <span>{criterion.label}</span>
          <span className="essay-rubric-score-input">
            <input
              type="number"
              min={0}
              max={criterion.points}
              step="0.5"
              value={scores[index] ?? 0}
              onChange={(event) => {
                const next = [...scores];
                next[index] = event.target.value === "" ? 0 : Number(event.target.value);
                onChange(next);
              }}
            />
            <small>/ {criterion.points}</small>
          </span>
        </label>
      ))}
    </div>
  );
}

function monitorStatus(row: ExamMonitorRow) {
  if (!row.attemptId || row.status === "not_started") return "Belum mulai";
  if (row.status === "in_progress" && row.isPaused) return "Dihentikan";
  if (row.status === "in_progress") return "Mengerjakan";
  if (row.status === "submitted" || row.status === "grading") return "Dikumpulkan";
  return "Selesai";
}

function integrityEventLabel(eventType: string) {
  const labels: Record<string, string> = {
    tab_hidden: "Halaman ujian tidak terlihat",
    app_backgrounded: "Aplikasi masuk ke latar belakang",
    fullscreen_exit: "Keluar dari mode layar penuh",
    copy: "Mencoba menyalin konten",
    paste: "Mencoba menempelkan konten",
    reconnect: "Koneksi tersambung kembali",
  };
  return labels[eventType] ?? eventType.replace(/_/g, " ");
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
      <p>{loading ? "Mengambil data terbaru dari server." : error || empty}</p>
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
  const navigate = useNavigate();
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [subjects, setSubjects] = useState<Option[]>([]);
  const [classes, setClasses] = useState<Option[]>([]);
  const [assignmentPairs, setAssignmentPairs] = useState<AssignmentPair[]>([]);
  const [questions, setQuestions] = useState<QuestionOption[]>([]);
  const [questionUsages, setQuestionUsages] = useState<Record<string, QuestionUsage[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<ExamDraft | null>(null);
  const [examStep, setExamStep] = useState<0 | 1 | 2>(0);
  const [saving, setSaving] = useState(false);
  const [securityDefaults, setSecurityDefaults] = useState({ fullscreen: true, recordTabs: true });
  const [schoolTimezone, setSchoolTimezone] = useState("Asia/Jakarta");
  const [page, setPage] = useState(1);
  const [attemptSummaries, setAttemptSummaries] = useState<Record<string, ExamAttemptSummary>>({});
  const [detailExam, setDetailExam] = useState<ExamRow | null>(null);
  const [detailKind, setDetailKind] = useState<"questions" | "results" | "monitor">("questions");
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [questionPreview, setQuestionPreview] = useState<ExamQuestionPreview[]>([]);
  const [studentResults, setStudentResults] = useState<ExamStudentResult[]>([]);
  const [monitorRows, setMonitorRows] = useState<ExamMonitorRow[]>([]);
  const [controllingAttemptId, setControllingAttemptId] = useState("");
  const [monitorSearch, setMonitorSearch] = useState("");
  const [monitorFilter, setMonitorFilter] = useState("all");
  const [monitorSort, setMonitorSort] = useState("name");
  const [timelineStudent, setTimelineStudent] = useState("");
  const [integrityTimeline, setIntegrityTimeline] = useState<IntegrityTimelineItem[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  const load = useCallback(async () => {
    const client = supabase;
    if (!client) {
      setError("Server belum dikonfigurasi. Hubungi administrator.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const [examResult, subjectResult, classResult, assignmentResult, questionResult, questionUsageResult, settingsResult, attemptResult] = await Promise.all([
      fetchAllPages((from, to) =>
        client
          .from("exams")
          .select("id,title,description,subject_id,class_id,starts_at,ends_at,duration_minutes,status,has_access_code,shuffle_questions,shuffle_options,fullscreen_mode,record_tab_switches,subjects(name),classes(name),exam_questions(count),exam_assignments(count)")
          .order("starts_at", { ascending: false })
          .range(from, to),
      ),
      client.from("subjects").select("id,name").order("name"),
      client.from("classes").select("id,name").order("name"),
      client.from("teacher_subjects").select("class_id,subject_id"),
      fetchAllPages((from, to) =>
        client
          .from("questions")
          .select("id,body,type,question_banks(name,subject_id)")
          .eq("archived", false)
          .order("created_at", { ascending: false })
          .range(from, to),
      ),
      fetchAllPages((from, to) =>
        client
          .from("exam_questions")
          .select("question_id,exam_id")
          .range(from, to),
      ),
      client.from("school_profile_settings").select("require_fullscreen_default,record_tab_switches,school_timezone").eq("id", 1).maybeSingle(),
      fetchAllPages((from, to) =>
        client
          .from("attempts")
          .select("exam_id,status")
          .range(from, to),
      ),
    ]);
    const requestError = examResult.error ?? subjectResult.error ?? classResult.error ?? assignmentResult.error ?? questionResult.error ?? questionUsageResult.error ?? attemptResult.error;
    if (requestError) {
      setError(requestError.message);
    } else {
      const loadedExams = (examResult.data ?? []) as unknown as ExamRow[];
      setExams(loadedExams);
      setSubjects((subjectResult.data ?? []) as Option[]);
      setClasses((classResult.data ?? []) as Option[]);
      setAssignmentPairs((assignmentResult.data ?? []) as AssignmentPair[]);
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
      const examsById = new Map(loadedExams.map((exam) => [exam.id, exam]));
      const nextQuestionUsages: Record<string, QuestionUsage[]> = {};
      for (const row of questionUsageResult.data ?? []) {
        const exam = examsById.get(String(row.exam_id));
        if (!exam) continue;
        const questionId = String(row.question_id);
        (nextQuestionUsages[questionId] ??= []).push({
          examId: exam.id,
          examTitle: exam.title,
          className: relationName(exam.classes),
          startsAt: exam.starts_at,
        });
      }
      for (const usages of Object.values(nextQuestionUsages)) {
        usages.sort((left, right) => right.startsAt.localeCompare(left.startsAt));
      }
      setQuestionUsages(nextQuestionUsages);
      const nextAttemptSummaries: Record<string, ExamAttemptSummary> = {};
      for (const attempt of attemptResult.data ?? []) {
        const examId = String(attempt.exam_id);
        const summary = nextAttemptSummaries[examId] ?? { completed: 0, inProgress: 0 };
        if (["submitted", "grading", "final"].includes(String(attempt.status))) summary.completed += 1;
        if (attempt.status === "in_progress") summary.inProgress += 1;
        nextAttemptSummaries[examId] = summary;
      }
      setAttemptSummaries(nextAttemptSummaries);
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

  const assignedClasses = useMemo(
    () => classes.filter((item) =>
      assignmentPairs.some((assignment) => assignment.class_id === item.id),
    ),
    [assignmentPairs, classes],
  );

  const subjectsForClass = useCallback(
    (classId: string) => subjects.filter((subject) =>
      assignmentPairs.some(
        (assignment) =>
          assignment.class_id === classId && assignment.subject_id === subject.id,
      ),
    ),
    [assignmentPairs, subjects],
  );

  const openCreate = () => {
    const initialClassId = assignedClasses[0]?.id ?? "";
    const initialSubjectId = subjectsForClass(initialClassId)[0]?.id ?? "";
    if (!initialClassId || !initialSubjectId) {
      notify("Belum ada penugasan mata pelajaran untuk kelas. Hubungi Admin terlebih dahulu.", true);
      return;
    }
    const startsAt = isoToSchoolDateTimeInput(null, schoolTimezone);
    setExamStep(0);
    setDraft({
      title: "",
      description: "",
      subjectId: initialSubjectId,
      classId: initialClassId,
      startsAt,
      endsAt: addMinutesToSchoolDateTimeInput(startsAt, 90, schoolTimezone),
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
      endsAt: exam.ends_at
        ? isoToSchoolDateTimeInput(exam.ends_at, schoolTimezone)
        : addMinutesToSchoolDateTimeInput(
            isoToSchoolDateTimeInput(exam.starts_at, schoolTimezone),
            exam.duration_minutes,
            schoolTimezone,
          ),
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
    const duration = schoolDateTimeRangeMinutes(
      draft.startsAt,
      draft.endsAt,
      schoolTimezone,
    );
    if (!isValidExamDuration(duration ?? "")) {
      notify("Waktu selesai harus setelah waktu mulai, dengan rentang maksimal 8 jam.", true);
      return;
    }
    if (draft.accessCode.trim() && draft.accessCode.trim().length < 4) {
      notify("Kode akses minimal terdiri dari 4 karakter.", true);
      return;
    }
    setSaving(true);
    const startsAt = schoolDateTimeToIso(draft.startsAt, schoolTimezone);
    const endsAt = schoolDateTimeToIso(draft.endsAt, schoolTimezone);
    if (!startsAt || !endsAt) {
      setSaving(false);
      notify("Tanggal dan waktu mulai atau selesai tidak valid.", true);
      return;
    }
    const { error: saveError } = await supabase.rpc("save_managed_exam", {
      target_exam_id: draft.id ?? null,
      exam_title: draft.title.trim(),
      exam_description: draft.description.trim() || null,
      target_subject_id: draft.subjectId,
      target_class_id: draft.classId,
      start_time: startsAt,
      duration_in_minutes: duration,
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

  const moveQuestion = (questionId: string, direction: -1 | 1) => {
    setDraft((currentDraft) => {
      if (!currentDraft) return currentDraft;
      const currentIndex = currentDraft.questionIds.indexOf(questionId);
      const nextIndex = currentIndex + direction;
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= currentDraft.questionIds.length) return currentDraft;
      const questionIds = [...currentDraft.questionIds];
      [questionIds[currentIndex], questionIds[nextIndex]] = [questionIds[nextIndex], questionIds[currentIndex]];
      return { ...currentDraft, questionIds };
    });
  };

  const openQuestionPreview = async (exam: ExamRow) => {
    if (!supabase) return;
    setDetailExam(exam);
    setDetailKind("questions");
    setDetailLoading(true);
    setDetailError("");
    setQuestionPreview([]);
    const { data, error: previewError } = await supabase
      .from("exam_questions")
      .select("position,questions(id,body,type,options)")
      .eq("exam_id", exam.id)
      .order("position", { ascending: true });
    if (previewError) setDetailError(previewError.message);
    else {
      setQuestionPreview((data ?? []).map((row) => {
        const question = nestedRecord(row.questions);
        return {
          id: String(question.id ?? `${exam.id}-${row.position}`),
          position: Number(row.position),
          body: String(question.body ?? "Soal"),
          type: String(question.type) === "essay" ? "essay" : "multiple_choice",
          options: Array.isArray(question.options) ? question.options.map(String) : [],
        };
      }));
    }
    setDetailLoading(false);
  };

  const openStudentResults = async (exam: ExamRow) => {
    if (!supabase) return;
    setDetailExam(exam);
    setDetailKind("results");
    setDetailLoading(true);
    setDetailError("");
    setStudentResults([]);
    const { data, error: resultError } = await supabase
      .from("attempts")
      .select("id,status,student_id,final_score,submitted_at")
      .eq("exam_id", exam.id)
      .in("status", ["submitted", "grading", "final"])
      .order("submitted_at", { ascending: false });
    if (resultError) setDetailError(resultError.message);
    else {
      const attempts = data ?? [];
      const studentIds = [...new Set(attempts.map((attempt) => attempt.student_id))];
      const profileResult = studentIds.length
        ? await supabase.from("profiles").select("id,full_name").in("id", studentIds)
        : { data: [], error: null };
      if (profileResult.error) {
        setDetailError(profileResult.error.message);
        setDetailLoading(false);
        return;
      }
      const studentNames = new Map((profileResult.data ?? []).map((profile) => [profile.id, profile.full_name]));
      const normalized = attempts.map((attempt) => ({
        id: attempt.id,
        studentName: studentNames.get(attempt.student_id) || "Siswa",
        status: attempt.status,
        score: attempt.final_score === null ? null : Number(attempt.final_score),
        submittedAt: attempt.submitted_at,
        answers: [],
      }));
      setStudentResults(normalized);
    }
    setDetailLoading(false);
  };

  const loadExamMonitor = useCallback(async (examId: string, showLoading = false) => {
    const client = supabase;
    if (!client) return;
    if (showLoading) setDetailLoading(true);
    const { data, error: monitorError } = await client.rpc("get_exam_monitor", {
      target_exam_id: examId,
    });
    if (monitorError) {
      setDetailError(monitorError.message);
    } else {
      setDetailError("");
      setMonitorRows((data ?? []).map((row: Record<string, unknown>) => ({
        studentId: String(row.student_id),
        studentName: String(row.student_name ?? "Siswa"),
        attemptId: row.attempt_id ? String(row.attempt_id) : null,
        status: String(row.attempt_status ?? "not_started"),
        startedAt: row.started_at ? String(row.started_at) : null,
        submittedAt: row.submitted_at ? String(row.submitted_at) : null,
        isPaused: Boolean(row.is_paused),
        isOnline: Boolean(row.is_online),
        lastSeenAt: row.last_seen_at ? String(row.last_seen_at) : null,
        extraTimeMinutes: Number(row.extra_time_minutes ?? 0),
        answeredCount: Number(row.answered_count ?? 0),
        exitCount: Number(row.exit_count ?? 0),
      })));
    }
    if (showLoading) setDetailLoading(false);
  }, []);

  const openExamMonitor = async (exam: ExamRow) => {
    if (currentExamStatus(exam) === "selesai") {
      notify("Ujian sudah berakhir. Pengawasan langsung tidak dapat dibuka.");
      return;
    }
    setDetailExam(exam);
    setDetailKind("monitor");
    setDetailError("");
    setMonitorRows([]);
    setMonitorSearch("");
    setMonitorFilter("all");
    setMonitorSort("name");
    setTimelineStudent("");
    setIntegrityTimeline([]);
    await loadExamMonitor(exam.id, true);
  };

  const setStudentSessionPaused = async (row: ExamMonitorRow) => {
    if (!supabase || !row.attemptId) return;
    setControllingAttemptId(row.attemptId);
    const shouldPause = !row.isPaused;
    const { error: controlError } = await supabase.rpc("set_student_attempt_paused", {
      target_attempt_id: row.attemptId,
      should_pause: shouldPause,
    });
    setControllingAttemptId("");
    if (controlError) {
      notify(controlError.message, true);
      return;
    }
    notify(shouldPause
      ? `Sesi ${row.studentName} dihentikan sementara.`
      : `Sesi ${row.studentName} dilanjutkan.`);
    if (detailExam) await loadExamMonitor(detailExam.id);
  };

  const setAllStudentSessionsPaused = async (shouldPause: boolean) => {
    if (!supabase || !detailExam) return;
    setControllingAttemptId("bulk");
    const { data, error: controlError } = await supabase.rpc("set_exam_attempts_paused", {
      target_exam_id: detailExam.id,
      should_pause: shouldPause,
    });
    setControllingAttemptId("");
    if (controlError) {
      notify(controlError.message, true);
      return;
    }
    notify(`${Number(data ?? 0)} sesi berhasil ${shouldPause ? "dihentikan" : "dilanjutkan"}.`);
    await loadExamMonitor(detailExam.id);
  };

  const grantExtraTime = async (row: ExamMonitorRow) => {
    if (!supabase || !row.attemptId || !detailExam) return;
    const rawMinutes = window.prompt(`Tambahkan waktu untuk ${row.studentName} (1–240 menit):`, "10");
    if (rawMinutes === null) return;
    const minutes = Number(rawMinutes);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 240) {
      notify("Waktu tambahan harus berupa menit bulat antara 1 dan 240.", true);
      return;
    }
    setControllingAttemptId(row.attemptId);
    const { error: controlError } = await supabase.rpc("grant_attempt_extra_time", {
      target_attempt_id: row.attemptId,
      extra_minutes: minutes,
    });
    setControllingAttemptId("");
    if (controlError) notify(controlError.message, true);
    else {
      notify(`${minutes} menit ditambahkan untuk ${row.studentName}.`);
      await loadExamMonitor(detailExam.id);
    }
  };

  const forceSubmitAttempt = async (row: ExamMonitorRow) => {
    if (!supabase || !row.attemptId || !detailExam) return;
    if (!window.confirm(`Kumpulkan paksa ujian ${row.studentName}? Jawaban tidak dapat diubah setelah dikumpulkan.`)) return;
    setControllingAttemptId(row.attemptId);
    const { error: controlError } = await supabase.rpc("force_submit_exam_attempt", {
      target_attempt_id: row.attemptId,
    });
    setControllingAttemptId("");
    if (controlError) notify(controlError.message, true);
    else {
      notify(`Ujian ${row.studentName} berhasil dikumpulkan.`);
      await loadExamMonitor(detailExam.id);
    }
  };

  const resetAttempt = async (row: ExamMonitorRow) => {
    if (!supabase || !row.attemptId || !detailExam) return;
    if (!window.confirm(`Buka ulang ujian untuk ${row.studentName}? Jawaban, nilai, dan riwayat aktivitas attempt ini akan dihapus.`)) return;
    setControllingAttemptId(row.attemptId);
    const { error: controlError } = await supabase.rpc("reset_exam_attempt", {
      target_attempt_id: row.attemptId,
    });
    setControllingAttemptId("");
    if (controlError) notify(controlError.message, true);
    else {
      notify(`Ujian ${row.studentName} dibuka ulang dari awal.`);
      setTimelineStudent("");
      setIntegrityTimeline([]);
      await loadExamMonitor(detailExam.id);
    }
  };

  const loadIntegrityTimeline = async (row: ExamMonitorRow) => {
    if (!supabase || !row.attemptId) return;
    setTimelineStudent(row.studentName);
    setTimelineLoading(true);
    const { data, error: timelineError } = await supabase.rpc("get_attempt_integrity_timeline", {
      target_attempt_id: row.attemptId,
    });
    setTimelineLoading(false);
    if (timelineError) {
      notify(timelineError.message, true);
      return;
    }
    setIntegrityTimeline((data ?? []).map((item: Record<string, unknown>) => ({
      id: String(item.event_id),
      type: String(item.event_type),
      occurredAt: String(item.occurred_at),
      metadata: (item.metadata ?? {}) as Record<string, unknown>,
    })));
  };

  useEffect(() => {
    const client = supabase;
    if (!client || detailKind !== "monitor" || !detailExam) return;
    const refresh = () => void loadExamMonitor(detailExam.id);
    const channel = client
      .channel(`exam-monitor:${detailExam.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "attempts",
          filter: `exam_id=eq.${detailExam.id}`,
        },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "integrity_events" },
        refresh,
      )
      .subscribe();
    const intervalId = window.setInterval(refresh, 5_000);
    return () => {
      window.clearInterval(intervalId);
      void client.removeChannel(channel);
    };
  }, [detailExam, detailKind, loadExamMonitor]);

  const closeDetail = () => {
    setDetailExam(null);
    setDetailError("");
    setQuestionPreview([]);
    setStudentResults([]);
    setMonitorRows([]);
    setTimelineStudent("");
    setIntegrityTimeline([]);
  };

  const nextExamStep = () => {
    if (!draft) return;
    if (examStep === 0) {
      if (!draft.title.trim() || !draft.subjectId || !draft.classId) {
        notify("Lengkapi judul, mata pelajaran, dan kelas peserta.", true);
        return;
      }
      const duration = schoolDateTimeRangeMinutes(
        draft.startsAt,
        draft.endsAt,
        schoolTimezone,
      );
      if (!draft.startsAt || !draft.endsAt || !isValidExamDuration(duration ?? "")) {
        notify("Periksa jadwal mulai dan selesai. Rentang ujian harus 1 menit sampai 8 jam.", true);
        return;
      }
    }
    if (examStep === 1 && !draft.questionIds.length) {
      notify("Pilih minimal satu soal sebelum melanjutkan.", true);
      return;
    }
    setExamStep((current) => Math.min(2, current + 1) as 0 | 1 | 2);
  };

  const updateExamStart = (startsAt: string) => {
    if (!draft) return;
    const currentDuration = schoolDateTimeRangeMinutes(
      draft.startsAt,
      draft.endsAt,
      schoolTimezone,
    );
    setDraft({
      ...draft,
      startsAt,
      endsAt: addMinutesToSchoolDateTimeInput(
        startsAt,
        currentDuration !== null && isValidExamDuration(currentDuration)
          ? currentDuration
          : 90,
        schoolTimezone,
      ),
    });
  };

  const closeExamModal = () => {
    if (saving) return;
    setDraft(null);
    setExamStep(0);
  };
  const examDialogRef = useAccessibleDialog(closeExamModal, saving, Boolean(draft));
  const detailDialogRef = useAccessibleDialog(closeDetail, detailLoading, Boolean(detailExam));

  const selectedSubjectName = subjects.find((item) => item.id === draft?.subjectId)?.name ?? "Belum dipilih";
  const selectedClassName = classes.find((item) => item.id === draft?.classId)?.name ?? "Belum dipilih";
  const availableDraftSubjects = subjectsForClass(draft?.classId ?? "");
  const draftDuration = draft
    ? schoolDateTimeRangeMinutes(draft.startsAt, draft.endsAt, schoolTimezone)
    : null;
  const visibleMonitorRows = useMemo(() => {
    const query = monitorSearch.trim().toLocaleLowerCase("id-ID");
    const filtered = monitorRows.filter((row) => {
      if (query && !row.studentName.toLocaleLowerCase("id-ID").includes(query)) return false;
      if (monitorFilter === "active") return row.status === "in_progress" && row.isOnline && !row.isPaused;
      if (monitorFilter === "offline") return row.status === "in_progress" && !row.isOnline;
      if (monitorFilter === "paused") return row.isPaused;
      if (monitorFilter === "indications") return row.exitCount > 0;
      if (monitorFilter === "completed") return ["submitted", "grading", "final"].includes(row.status);
      return true;
    });
    return [...filtered].sort((left, right) => {
      if (monitorSort === "exits") return right.exitCount - left.exitCount || left.studentName.localeCompare(right.studentName, "id-ID");
      if (monitorSort === "answers") return right.answeredCount - left.answeredCount || left.studentName.localeCompare(right.studentName, "id-ID");
      return left.studentName.localeCompare(right.studentName, "id-ID");
    });
  }, [monitorFilter, monitorRows, monitorSearch, monitorSort]);
  const examStepTitles = ["Informasi dasar", "Pilih soal", "Keamanan & publikasi"];

  return (
    <div className="portal-page">
      <PageHeader
        eyebrow="MANAJEMEN UJIAN"
        title="Kumpulan Ujian"
        description="Kelola susunan soal dan lihat hasil siswa dari setiap ujian."
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
        <div>
          <div className="exam-collection-grid">
            {pagedExams.map((exam) => {
              const status = currentExamStatus(exam);
              const summary = attemptSummaries[exam.id] ?? { completed: 0, inProgress: 0 };
              return (
                <article className="exam-collection-card" key={exam.id}>
                  <div className="exam-card-topline">
                    <span className="exam-card-subject"><FileQuestion /> {relationName(exam.subjects)}</span>
                    <div>
                      <span className={`status ${status}`}><i />{status[0].toUpperCase() + status.slice(1)}</span>
                      <button type="button" className="exam-delete" aria-label={`Hapus ${exam.title}`} title="Hapus ujian" onClick={() => void removeExam(exam)}><Trash2 /></button>
                    </div>
                  </div>
                  <h2>{exam.title}</h2>
                  <div className="exam-card-meta">
                    <span><b>{relationName(exam.classes)}</b>Kelas</span>
                    <span><b>{relationCount(exam.exam_questions)} soal</b>Susunan tetap</span>
                    <span><b>{exam.duration_minutes} menit</b>Durasi</span>
                  </div>
                  <p className="exam-card-schedule">
                    {formatDate(exam.starts_at, schoolTimezone)} – {formatDate(exam.ends_at, schoolTimezone)} · {schoolTimezone}
                  </p>
                  <div className="exam-card-participants">
                    <span><Users /><b>{relationCount(exam.exam_assignments)}</b> peserta</span>
                    <span><CheckCircle2 /><b>{summary.completed}</b> sudah mengerjakan</span>
                    {summary.inProgress > 0 && <span><LoaderCircle /><b>{summary.inProgress}</b> mengerjakan</span>}
                  </div>
                  <div className="exam-card-actions">
                    <button type="button" onClick={() => void openQuestionPreview(exam)}><Eye /> Lihat soal</button>
                    <button type="button" onClick={() => void openExamMonitor(exam)}><Radio /> Awasi ujian</button>
                    <button type="button" className="primary" onClick={() => void openStudentResults(exam)}><ClipboardCheck /> Hasil siswa</button>
                    <button type="button" className="icon" title="Edit ujian" aria-label={`Edit ${exam.title}`} onClick={() => void openEdit(exam)}><Pencil /></button>
                  </div>
                </article>
              );
            })}
          </div>
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
          <div ref={examDialogRef} className="modal wide" role="dialog" aria-modal="true" tabIndex={-1}>
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
                      <label className="form-field"><span>Kelas peserta</span><select value={draft.classId} onChange={(event) => { const classId = event.target.value; setDraft({ ...draft, classId, subjectId: subjectsForClass(classId)[0]?.id ?? "", questionIds: [] }); }}>{assignedClasses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                      <label className="form-field"><span>Mata pelajaran</span><select value={draft.subjectId} onChange={(event) => setDraft({ ...draft, subjectId: event.target.value, questionIds: [] })}>{availableDraftSubjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
                      <label className="form-field"><span>Tanggal & jam mulai <small>({schoolTimezone})</small></span><input type="datetime-local" value={draft.startsAt} onChange={(event) => updateExamStart(event.target.value)} /></label>
                      <label className="form-field"><span>Tanggal & jam selesai <small>({schoolTimezone})</small></span><input type="datetime-local" value={draft.endsAt} min={addMinutesToSchoolDateTimeInput(draft.startsAt, 1, schoolTimezone) || undefined} max={addMinutesToSchoolDateTimeInput(draft.startsAt, 480, schoolTimezone) || undefined} onChange={(event) => setDraft({ ...draft, endsAt: event.target.value })} /></label>
                      <label className="form-field"><span>Batas waktu pengerjaan</span><input readOnly value={isValidExamDuration(draftDuration ?? "") ? `${draftDuration} menit` : "Periksa waktu selesai"} aria-invalid={!isValidExamDuration(draftDuration ?? "")} /></label>
                      <label className="form-field"><span>Status awal</span><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as ExamDraft["status"] })}><option value="draft">Simpan sebagai draft</option><option value="terjadwal">Jadwalkan untuk peserta</option></select></label>
                    </div>
                  </div>
                )}
                {examStep === 1 && (
                  <div className="exam-step">
                    <p className="exam-step-intro">Susunan di bawah menjadi <b>urutan asli yang tetap</b> untuk guru. Saat siswa mengerjakan, server mengacaknya secara konsisten khusus untuk sesi siswa tersebut.</p>
                    {!!draft.questionIds.length && <div className="question-order-list">
                      <div><b>Susunan soal ujian</b><span>{draft.questionIds.length} soal</span></div>
                      {draft.questionIds.map((questionId, index) => {
                        const question = questions.find((item) => item.id === questionId);
                        if (!question) return null;
                        return <div className="question-order-row" key={questionId}>
                          <i>{index + 1}</i>
                          <p>
                            <b>{question.body}</b>
                            <small>{question.type === "essay" ? "Essay" : "Pilihan Ganda"}</small>
                            <QuestionUsageNotice usages={questionUsages[questionId] ?? []} currentExamId={draft.id} />
                          </p>
                          <button type="button" title="Naikkan" aria-label={`Naikkan soal ${index + 1}`} disabled={index === 0} onClick={() => moveQuestion(questionId, -1)}><ArrowUp /></button>
                          <button type="button" title="Turunkan" aria-label={`Turunkan soal ${index + 1}`} disabled={index === draft.questionIds.length - 1} onClick={() => moveQuestion(questionId, 1)}><ArrowDown /></button>
                          <button type="button" className="danger" title="Keluarkan" aria-label={`Keluarkan soal ${index + 1}`} onClick={() => toggleQuestion(questionId, false)}><X /></button>
                        </div>;
                      })}
                    </div>}
                    <div className="real-question-picker">
                      <div><b>Tambahkan dari {selectedSubjectName}</b><span>{filteredQuestions.length - draft.questionIds.length} tersedia</span></div>
                      {!filteredQuestions.length ? <p>Belum ada soal pada bank soal mata pelajaran ini. Tutup formulir, lalu tambahkan soal terlebih dahulu.</p> : filteredQuestions.filter((question) => !draft.questionIds.includes(question.id)).map((question) => (
                        <label key={question.id}>
                          <input type="checkbox" checked={false} onChange={(event) => toggleQuestion(question.id, event.target.checked)} />
                          <span>
                            <b>{question.body}</b>
                            <small>{question.bank} · {question.type === "essay" ? "Essay" : "Pilihan Ganda"}</small>
                            <QuestionUsageNotice usages={questionUsages[question.id] ?? []} currentExamId={draft.id} />
                          </span>
                        </label>
                      ))}
                      {!!filteredQuestions.length && filteredQuestions.every((question) => draft.questionIds.includes(question.id)) && <p>Semua soal pada mata pelajaran ini sudah dimasukkan.</p>}
                    </div>
                  </div>
                )}
                {examStep === 2 && (
                  <div className="exam-step">
                    <div className="exam-review" aria-label="Ringkasan ujian">
                      <div><small>Mata pelajaran</small><b>{selectedSubjectName}</b></div>
                      <div><small>Kelas</small><b>{selectedClassName}</b></div>
                      <div><small>Isi ujian</small><b>{draft.questionIds.length} soal · {isValidExamDuration(draftDuration ?? "") ? `${draftDuration} menit` : "jadwal belum valid"}</b></div>
                      <div><small>Jadwal</small><b>{draft.startsAt.replace("T", " ")} – {draft.endsAt.replace("T", " ")}</b></div>
                    </div>
                    <label className="form-field"><span>{draft.hadAccessCode ? "Kode akses baru (kosong = pertahankan)" : "Kode akses (opsional)"}</span><input value={draft.accessCode} disabled={draft.removeAccessCode} minLength={4} maxLength={64} autoComplete="off" placeholder="Minimal 4 karakter" onChange={(event) => setDraft({ ...draft, accessCode: event.target.value.toUpperCase(), removeAccessCode: false })} /></label>
                    {draft.hadAccessCode && <label className="real-remove-access-code"><input type="checkbox" checked={draft.removeAccessCode} onChange={(event) => setDraft({ ...draft, removeAccessCode: event.target.checked, accessCode: "" })} /> Hapus kode akses yang tersimpan</label>}
                    <div className="switch-list real-switches">
                      <label><span><b>Acak khusus saat siswa mengerjakan</b><small>Susunan asli guru tetap; setiap sesi siswa menerima urutan soal yang konsisten.</small></span><input type="checkbox" checked={draft.shuffleQuestions} onChange={(event) => setDraft({ ...draft, shuffleQuestions: event.target.checked })} /></label>
                      <label><span><b>Acak pilihan jawaban siswa</b><small>Opsi pilihan ganda hanya diacak pada sesi pengerjaan siswa.</small></span><input type="checkbox" checked={draft.shuffleOptions} onChange={(event) => setDraft({ ...draft, shuffleOptions: event.target.checked })} /></label>
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
      {detailExam && (
        <div className="modal-overlay">
          <div ref={detailDialogRef} className="modal wide" role="dialog" aria-modal="true" tabIndex={-1}>
            <div className="simple-modal exam-detail-modal">
              <header>
                <div>
                  <p>{detailKind === "questions" ? "SUSUNAN SOAL" : detailKind === "monitor" ? "PENGAWASAN LANGSUNG" : "HASIL SISWA"}</p>
                  <h2>{detailExam.title}</h2>
                </div>
                <button type="button" aria-label="Tutup detail ujian" onClick={closeDetail}><X /></button>
              </header>
              <div className="modal-content">
                {detailLoading ? <div className="detail-loading"><LoaderCircle className="spin" /> Memuat data…</div> : detailError ? <div className="detail-error"><AlertTriangle />{detailError}</div> : detailKind === "questions" ? (
                  <>
                    <div className="stable-order-note"><ClipboardList /><p><b>Urutan asli ujian</b><span>Daftar ini selalu tersusun sama. Pengacakan hanya diterapkan ketika masing-masing siswa mulai mengerjakan.</span></p></div>
                    <div className="exam-question-preview">
                      {questionPreview.map((question, index) => <article key={question.id}>
                        <span>{index + 1}</span>
                        <div><small>{question.type === "essay" ? "ESSAY" : "PILIHAN GANDA"}</small><b>{question.body}</b>{question.options.length > 0 && <ol type="A">{question.options.map((option, optionIndex) => <li key={`${question.id}-${optionIndex}`}>{option}</li>)}</ol>}</div>
                      </article>)}
                      {!questionPreview.length && <p className="inline-empty">Belum ada soal pada ujian ini.</p>}
                    </div>
                  </>
                ) : detailKind === "monitor" ? (
                  <div className="exam-monitor">
                    <div className="exam-monitor-summary">
                      <div><Radio /><p><b>{monitorRows.filter((row) => row.status === "in_progress" && row.isOnline && !row.isPaused).length} siswa online</b><span>Status online berasal dari heartbeat browser, diperbarui setiap 15 detik.</span></p></div>
                      <div className="exam-monitor-bulk-actions">
                        <button type="button" disabled={controllingAttemptId === "bulk"} onClick={() => void setAllStudentSessionsPaused(true)}><Pause /> Hentikan semua</button>
                        <button type="button" disabled={controllingAttemptId === "bulk"} onClick={() => void setAllStudentSessionsPaused(false)}><Play /> Lanjutkan semua</button>
                        <button type="button" onClick={() => void loadExamMonitor(detailExam.id)}><RefreshCw /> Perbarui</button>
                      </div>
                    </div>
                    <div className="exam-monitor-toolbar">
                      <label><Search /><input value={monitorSearch} onChange={(event) => setMonitorSearch(event.target.value)} placeholder="Cari nama siswa…" /></label>
                      <select value={monitorFilter} onChange={(event) => setMonitorFilter(event.target.value)} aria-label="Filter peserta pengawasan">
                        <option value="all">Semua peserta</option>
                        <option value="active">Online & aktif</option>
                        <option value="offline">Koneksi terputus</option>
                        <option value="paused">Dihentikan</option>
                        <option value="indications">Ada indikasi aktivitas</option>
                        <option value="completed">Sudah dikumpulkan</option>
                      </select>
                      <select value={monitorSort} onChange={(event) => setMonitorSort(event.target.value)} aria-label="Urutkan peserta pengawasan">
                        <option value="name">Urutkan nama</option>
                        <option value="exits">Indikasi terbanyak</option>
                        <option value="answers">Jawaban terbanyak</option>
                      </select>
                    </div>
                    <div className="exam-monitor-list">
                      {visibleMonitorRows.map((row) => {
                        const statusLabel = monitorStatus(row);
                        return <article key={row.studentId} className={`exam-monitor-row${row.isPaused ? " paused" : ""}`}>
                          <span className="exam-monitor-avatar">{initials(row.studentName)}</span>
                          <div className="exam-monitor-student">
                            <b>{row.studentName}</b>
                            <small>{row.startedAt ? `Mulai ${formatDate(row.startedAt, schoolTimezone)}` : "Belum membuka ujian"}</small>
                            {row.attemptId && <small className={row.isOnline ? "online" : "offline"}>{row.isOnline ? <Wifi /> : <WifiOff />}{row.isOnline ? "Online" : row.lastSeenAt ? `Terakhir online ${formatDate(row.lastSeenAt, schoolTimezone)}` : "Belum ada heartbeat"}</small>}
                          </div>
                          <div className="exam-monitor-metrics">
                            <span><CheckCircle2 /> {row.answeredCount} jawaban</span>
                            <span className={row.exitCount > 0 ? "warning" : ""}><AlertTriangle /> Indikasi keluar halaman {row.exitCount}×</span>
                            {row.extraTimeMinutes > 0 && <span><Clock3 /> Tambahan {row.extraTimeMinutes} menit</span>}
                          </div>
                          <em className={`exam-monitor-status ${row.status}${row.isPaused ? " paused" : ""}`}>{statusLabel}</em>
                          {row.attemptId ? <div className="exam-monitor-actions">
                            {row.status === "in_progress" && <button type="button" className={row.isPaused ? "resume" : "pause"} disabled={controllingAttemptId === row.attemptId} onClick={() => void setStudentSessionPaused(row)}>{row.isPaused ? <Play /> : <Pause />}{row.isPaused ? "Lanjutkan" : "Hentikan"}</button>}
                            {row.status === "in_progress" && <button type="button" disabled={controllingAttemptId === row.attemptId} onClick={() => void grantExtraTime(row)}><Clock3 /> + Waktu</button>}
                            {row.status === "in_progress" && <button type="button" disabled={controllingAttemptId === row.attemptId} onClick={() => void forceSubmitAttempt(row)}><Send /> Kumpulkan</button>}
                            <button type="button" onClick={() => void loadIntegrityTimeline(row)}><AlertTriangle /> Aktivitas</button>
                            <button type="button" className="danger" disabled={controllingAttemptId === row.attemptId} onClick={() => void resetAttempt(row)}><RotateCcw /> Buka ulang</button>
                          </div> : <span className="exam-monitor-no-action">Belum mulai</span>}
                        </article>;
                      })}
                      {!visibleMonitorRows.length && <p className="inline-empty">Tidak ada peserta yang sesuai dengan filter.</p>}
                    </div>
                    {timelineStudent && <section className="integrity-timeline">
                      <header><div><b>Indikasi aktivitas · {timelineStudent}</b><span>Catatan ini adalah sinyal untuk ditinjau, bukan bukti kecurangan.</span></div><button type="button" onClick={() => { setTimelineStudent(""); setIntegrityTimeline([]); }}><X /></button></header>
                      {timelineLoading ? <p><LoaderCircle className="spin" /> Memuat aktivitas…</p> : integrityTimeline.length ? <ol>{integrityTimeline.map((item) => <li key={item.id}><AlertTriangle /><p><b>{integrityEventLabel(item.type)}</b><span>{formatDate(item.occurredAt, schoolTimezone)}</span></p></li>)}</ol> : <p>Tidak ada indikasi aktivitas yang tercatat.</p>}
                    </section>}
                  </div>
                ) : (
                  <div className="exam-result-list">
                    <div className="exam-result-summary"><CheckCircle2 /><p><b>{studentResults.length} siswa sudah mengerjakan</b><span>Nilai hanya terlihat oleh guru pada halaman ini.</span></p></div>
                    <div className="exam-result-students">
                      {studentResults.map((result) => <button type="button" key={result.id} className="exam-result-student-link" onClick={() => navigate(`/app/ujian/${detailExam.id}/hasil/${result.id}`)}>
                        <span>{initials(result.studentName)}</span>
                        <p><b>{result.studentName}</b><small>Dikumpulkan {formatDate(result.submittedAt, schoolTimezone)}</small></p>
                        <em className={result.score === null ? "pending" : ""}>{result.score === null ? "Menunggu koreksi" : `Nilai ${result.score}`}</em>
                      </button>)}
                    </div>
                    {!studentResults.length && <p className="inline-empty">Belum ada siswa yang mengumpulkan ujian ini.</p>}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function StudentAnswerReviewPage({ notify }: { notify: Notify }) {
  const { examId = "", attemptId = "" } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState<ExamStudentResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingAnswerId, setSavingAnswerId] = useState("");

  const load = useCallback(async () => {
    if (!supabase || !examId || !attemptId) {
      setError("Jawaban ujian tidak ditemukan.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const [attemptResult, questionResult, answerResult] = await Promise.all([
      supabase.from("attempts").select("id,status,student_id,final_score,submitted_at").eq("id", attemptId).eq("exam_id", examId).single(),
      supabase.from("exam_questions").select("question_id,position").eq("exam_id", examId).order("position"),
      supabase.from("answers").select("id,attempt_id,question_id,selected_option,essay_text,score,teacher_comment,rubric_scores,questions(body,type,options,answer_key,weight,rubric,correct_option)").eq("attempt_id", attemptId),
    ]);
    const loadError = attemptResult.error ?? questionResult.error ?? answerResult.error;
    if (loadError || !attemptResult.data) {
      setError(loadError?.message ?? "Jawaban ujian tidak ditemukan.");
      setLoading(false);
      return;
    }
    const profileResult = await supabase.from("profiles").select("id,full_name").eq("id", attemptResult.data.student_id).maybeSingle();
    if (profileResult.error) {
      setError(profileResult.error.message);
      setLoading(false);
      return;
    }
    const positions = new Map((questionResult.data ?? []).map((question) => [question.question_id, question.position]));
    const answers: StudentAnswerReview[] = (answerResult.data ?? []).map((row) => {
      const question = nestedRecord(row.questions);
      const weight = Number(question.weight ?? 1);
      const score = row.score === null ? null : Number(row.score);
      const rubric = normalizeRubricCriteria(question.rubric, weight);
      return {
        id: String(row.id),
        questionId: String(row.question_id),
        position: Number(positions.get(row.question_id) ?? 0),
        body: String(question.body ?? "Soal"),
        type: (String(question.type) === "essay" ? "essay" : "multiple_choice") as StudentAnswerReview["type"],
        options: Array.isArray(question.options) ? question.options.map(String) : [],
        selectedOption: row.selected_option === null ? null : Number(row.selected_option),
        essayText: String(row.essay_text ?? ""),
        score,
        comment: String(row.teacher_comment ?? ""),
        answerKey: String(question.answer_key ?? ""),
        correctOption: question.correct_option === null ? null : Number(question.correct_option),
        weight,
        rubric,
        rubricScores: normalizeRubricScores(row.rubric_scores, rubric, score),
      };
    }).sort((left, right) => left.position - right.position);
    setResult({
      id: attemptResult.data.id,
      studentName: profileResult.data?.full_name || "Siswa",
      status: attemptResult.data.status,
      score: attemptResult.data.final_score === null ? null : Number(attemptResult.data.final_score),
      submittedAt: attemptResult.data.submitted_at,
      answers,
    });
    setLoading(false);
  }, [attemptId, examId]);

  useEffect(() => { void load(); }, [load]);

  const updateAnswer = (answerId: string, patch: Partial<StudentAnswerReview>) => {
    setResult((current) => current ? { ...current, answers: current.answers.map((answer) => answer.id === answerId ? { ...answer, ...patch } : answer) } : current);
  };

  const saveEssay = async (answer: StudentAnswerReview) => {
    const rubricIsValid = answer.rubric.every((criterion, index) => {
      const score = answer.rubricScores[index];
      return Number.isFinite(score) && score >= 0 && score <= criterion.points;
    });
    if (!supabase || answer.score === null || answer.score < 0 || answer.score > answer.weight || !rubricIsValid) {
      notify(`Skor harus berada di antara 0 dan ${answer.weight}.`, true);
      return;
    }
    setSavingAnswerId(answer.id);
    const { error: saveError } = await supabase.rpc("grade_essay_answer", {
      target_answer_id: answer.id,
      awarded_score: answer.score,
      feedback: answer.comment.trim() || null,
      rubric_scores_payload: answer.rubric.map((criterion, index) => ({
        label: criterion.label,
        max_points: criterion.points,
        score: answer.rubricScores[index] ?? 0,
      })),
    });
    setSavingAnswerId("");
    if (saveError) {
      notify(saveError.message, true);
      return;
    }
    notify("Nilai essay berhasil disimpan.");
    await load();
  };

  return <div className="portal-page student-answer-page">
    <div className="page-title">
      <div><p>HASIL SISWA</p><h1>{result?.studentName ?? "Jawaban siswa"}</h1><span>{result ? `${result.answers.length} jawaban · Dikumpulkan ${formatDate(result.submittedAt)}` : "Memuat jawaban ujian"}</span></div>
      <button type="button" onClick={() => navigate(`/app/ujian`)}>Kembali ke ujian</button>
    </div>
    {loading || error || !result ? <PageState loading={loading} error={error} empty="Jawaban siswa belum tersedia." onRetry={() => void load()} /> : <>
      <div className="student-answer-page-summary"><span>{result.studentName}</span><strong>{result.score === null ? "Menunggu koreksi" : `Nilai ${result.score}`}</strong><small>{result.answers.length} jawaban</small></div>
      <div className="student-answer-page-list">{result.answers.map((answer) => <article className="student-answer-page-item" key={answer.id}>
        <div className="student-answer-question"><span>{answer.position || "-"}</span><div><small>{answer.type === "essay" ? "ESSAY" : "PILIHAN GANDA"}</small><b>{answer.body}</b></div></div>
        {answer.type === "essay" ? <>
          <div className="student-answer-text">{answer.essayText || "Siswa tidak memberikan jawaban."}</div>
          <div className="student-essay-grading">
            <RubricScoreEditor
              rubric={answer.rubric}
              scores={answer.rubricScores}
              onChange={(rubricScores) => updateAnswer(answer.id, {
                rubricScores,
                score: rubricScores.reduce((total, value) => total + Number(value || 0), 0),
              })}
            />
            <label className="form-field"><span>Komentar untuk siswa</span><input value={answer.comment} onChange={(event) => updateAnswer(answer.id, { comment: event.target.value })} placeholder="Berikan umpan balik singkat…" /></label>
            <button type="button" className="primary" disabled={savingAnswerId === answer.id || answer.score === null} onClick={() => void saveEssay(answer)}>{savingAnswerId === answer.id ? "Menyimpan…" : "Simpan koreksi"}</button>
          </div>
          <details><summary>Lihat pedoman jawaban</summary><p>{answer.answerKey || "Belum ada pedoman jawaban."}</p></details>
        </> : <div className={`student-choice-answer ${answer.selectedOption === answer.correctOption ? "correct" : "wrong"}`}><span>{answer.selectedOption === null ? "Tidak dijawab" : `Jawaban siswa: ${String.fromCharCode(65 + answer.selectedOption)}. ${answer.options[answer.selectedOption] ?? ""}`}</span><small>{answer.correctOption === null ? "Kunci belum ditentukan" : `Kunci: ${String.fromCharCode(65 + answer.correctOption)}. ${answer.options[answer.correctOption] ?? ""}`}</small></div>}
      </article>)}</div>
    </>}
  </div>;
}

export function RealGrading({ notify }: { notify: Notify }) {
  const [items, setItems] = useState<GradingItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rubricScores, setRubricScores] = useState<number[]>([]);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    const client = supabase;
    if (!client) {
      setError("Server belum dikonfigurasi.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const { data, error: loadError } = await fetchAllPages((from, to) =>
      client
        .from("answers")
        .select("id,attempt_id,question_id,essay_text,score,teacher_comment,rubric_scores,answered_at,questions!inner(id,body,answer_key,weight,rubric,type),attempts!inner(id,status,student_id,exam_id,submitted_at)")
        .eq("questions.type", "essay")
        .order("answered_at")
        .range(from, to),
    );
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
      studentIds.length ? client.from("profiles").select("id,full_name").in("id", studentIds) : Promise.resolve({ data: [], error: null }),
      examIds.length ? client.from("exams").select("id,title,classes(name)").in("id", examIds) : Promise.resolve({ data: [], error: null }),
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
      const weight = Number(question.weight ?? 1);
      const score = row.score === null ? null : Number(row.score);
      const rubric = normalizeRubricCriteria(question.rubric, weight);
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
        weight,
        score,
        comment: row.teacher_comment ?? "",
        rubric,
        rubricScores: normalizeRubricScores(row.rubric_scores, rubric, score),
        submittedAt: String(attempt.submitted_at ?? row.answered_at ?? "") || null,
      };
    });
    normalized.sort((a, b) => Number(a.score !== null) - Number(b.score !== null));
    setItems(normalized);
    setPage(1);
    setSelectedId((current) => current && normalized.some((item) => item.answerId === current) ? current : normalized[0]?.answerId ?? "");
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  const selected = items.find((item) => item.answerId === selectedId) ?? null;
  useEffect(() => {
    setComment(selected?.comment ?? "");
    setRubricScores(selected?.rubricScores ?? []);
  }, [selected]);

  const save = async () => {
    if (!supabase || !selected) return;
    const rubricIsValid = selected.rubric.every((criterion, index) => {
      const value = rubricScores[index];
      return Number.isFinite(value) && value >= 0 && value <= criterion.points;
    });
    const numericScore = rubricScores.reduce((total, value) => total + Number(value || 0), 0);
    if (!rubricIsValid || !Number.isFinite(numericScore) || numericScore < 0 || numericScore > selected.weight) {
      notify(`Skor harus berada di antara 0 dan ${selected.weight}.`, true);
      return;
    }
    setSaving(true);
    const { error: saveError } = await supabase.rpc("grade_essay_answer", {
      target_answer_id: selected.answerId,
      awarded_score: numericScore,
      feedback: comment.trim() || null,
      rubric_scores_payload: selected.rubric.map((criterion, index) => ({
        label: criterion.label,
        max_points: criterion.points,
        score: rubricScores[index] ?? 0,
      })),
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
  const pageSize = 50;
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pagedItems = items.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );
  useEffect(() => {
    if (!pagedItems.some((item) => item.answerId === selectedId)) {
      setSelectedId(pagedItems[0]?.answerId ?? "");
    }
  }, [pagedItems, selectedId]);
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
              {pagedItems.map((item) => <button type="button" key={item.answerId} className={selectedId === item.answerId ? "active" : ""} onClick={() => setSelectedId(item.answerId)}><span>{initials(item.studentName)}</span><p><b>{item.studentName}</b><small>{item.score === null ? "Belum dinilai" : `Skor ${item.score}/${item.weight}`}</small></p>{item.score !== null ? <CheckCircle2 /> : null}</button>)}
            </div>
            {items.length > pageSize && (
              <nav className="grading-pagination" aria-label="Halaman jawaban essay">
                <button type="button" disabled={safePage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Sebelumnya</button>
                <span>{safePage}/{pageCount}</span>
                <button type="button" disabled={safePage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>Berikutnya</button>
              </nav>
            )}
          </aside>
          <main className="grading-main">
            <div className="question-reference"><small>{selected.examTitle.toUpperCase()} · BOBOT {selected.weight} POIN</small><h3>{selected.question}</h3><details><summary>Lihat kunci jawaban</summary><p>{selected.answerKey}</p></details></div>
            <div className="answer-paper"><div><span className="avatar sm">{initials(selected.studentName)}</span><p><b>{selected.studentName}</b><small>{selected.className} · Dikumpulkan {formatDate(selected.submittedAt)}</small></p></div><p>{selected.essayText || "Siswa tidak memberikan jawaban."}</p></div>
            <div className="score-panel">
              <RubricScoreEditor rubric={selected.rubric} scores={rubricScores} onChange={setRubricScores} />
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
  const navigate = useNavigate();
  const [attempts, setAttempts] = useState<ReportAttempt[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisItem[]>([]);
  const [selectedExam, setSelectedExam] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [passingScore, setPassingScore] = useState(75);

  const loadAttempts = useCallback(async () => {
    const client = supabase;
    if (!client) {
      setError("Server belum dikonfigurasi.");
      setLoading(false);
      return;
    }
    setLoading(true);
    const [attemptResult, settingsResult] = await Promise.all([
      fetchAllPages((from, to) =>
        client
          .from("attempts")
          .select("id,exam_id,student_id,status,final_score,objective_score,essay_score,submitted_at,exams(title,classes(name)),profiles(full_name)")
          .in("status", ["submitted", "grading", "final"])
          .order("submitted_at", { ascending: false })
          .range(from, to),
      ),
      client.from("school_profile_settings").select("passing_score").eq("id", 1).maybeSingle(),
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
    const client = supabase;
    if (!client || !selectedExam) { setAnalysis([]); return; }
    let active = true;
    void fetchAllPages((from, to) =>
      client
        .from("answers")
        .select("question_id,selected_option,score,questions(body,type,correct_option,weight,difficulty),attempts!inner(exam_id,status)")
        .eq("attempts.exam_id", selectedExam)
        .in("attempts.status", ["submitted", "grading", "final"])
        .range(from, to),
    ).then(({ data, error: analysisError }) => {
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
    const csv = encodeCsv([
      header,
      ...rows.map((item) => [
        item.studentName,
        item.examTitle,
        item.className,
        item.status,
        item.score ?? "Belum final",
        formatDate(item.submittedAt),
      ]),
    ]);
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
        <section className="card report-student-results">
          <div className="card-head"><div><h3>Hasil per siswa</h3><span>Pilih siswa untuk membaca jawaban dan menyelesaikan koreksi essay.</span></div></div>
          <div className="report-student-table-wrap">
            <table className="report-student-table">
              <thead><tr><th>SISWA</th><th>DIKUMPULKAN</th><th>STATUS</th><th>NILAI</th><th /></tr></thead>
              <tbody>{rows.map((row) => <tr key={row.id}>
                <td><b>{row.studentName}</b><small>{row.className}</small></td>
                <td>{formatDate(row.submittedAt)}</td>
                <td><span className={`report-status ${row.status}`}>{row.status === "final" ? "Final" : row.status === "grading" ? "Menunggu koreksi" : "Terkumpul"}</span></td>
                <td><strong>{row.score === null ? "—" : row.score}</strong></td>
                <td><button type="button" className="report-answer-link" onClick={() => navigate(`/app/ujian/${row.examId}/hasil/${row.id}`)}>Lihat jawaban</button></td>
              </tr>)}</tbody>
            </table>
            {!rows.length && <div className="inline-empty">Belum ada peserta untuk ujian ini.</div>}
          </div>
        </section>
        <section className="card item-analysis"><div className="card-head"><h3>Analisis butir soal</h3></div>{!analysis.length ? <div className="inline-empty">Belum ada jawaban yang dapat dianalisis.</div> : analysis.map((item, index) => <div className="analysis-row" key={item.questionId}><span>{String(index + 1).padStart(2, "0")}</span><p><b>{item.body}</b><small>{item.type === "essay" ? "Essay · rata-rata skor" : "Pilihan Ganda · dijawab benar"}</small></p><div><small>{item.answered} JAWABAN</small><b>{item.value}%</b></div><span className={`difficulty ${item.difficulty}`}>{item.difficulty}</span></div>)}</section>
      </>}
    </div>
  );
}
