import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardCheck,
  Clock3,
  LoaderCircle,
  ShieldCheck,
  Star,
  Wifi,
  WifiOff,
} from "lucide-react";
import { BrandLogo } from "./BrandLogo";
import { loadLocal, saveLocal, supabase } from "../lib/supabase";

type Notify = (text: string, error?: boolean) => void;
type AnswerValue = number | string;
type RunnerQuestion = {
  id: string;
  text: string;
  kind: "multiple_choice" | "essay";
  options: string[];
  weight: number;
};
type ExamInfo = {
  title: string;
  subject: string;
  className: string;
  duration: number;
  fullscreen: boolean;
  recordTabSwitches: boolean;
};

function relationName(value: unknown, fallback = "—") {
  if (Array.isArray(value)) return String(value[0]?.name ?? fallback);
  if (value && typeof value === "object" && "name" in value) return String(value.name ?? fallback);
  return fallback;
}

function formatTime(seconds: number) {
  return `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function RealExamRunner({ notify }: { notify: Notify }) {
  const { examId = "" } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState<ExamInfo | null>(null);
  const [questions, setQuestions] = useState<RunnerQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>(() => loadLocal(`answers:${examId}`, {}));
  const [marked, setMarked] = useState<string[]>([]);
  const [current, setCurrent] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const finishingRef = useRef(false);

  const loadExam = useCallback(async () => {
    if (!supabase || !examId) {
      setError("Ujian tidak tersedia karena Supabase belum dikonfigurasi.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const [{ data: examRow, error: examError }, { data: questionRows, error: questionError }, { data: userData }] = await Promise.all([
      supabase.from("exams").select("title,duration_minutes,fullscreen_mode,record_tab_switches,subjects(name),classes(name)").eq("id", examId).single(),
      supabase.rpc("get_exam_questions", { requested_exam_id: examId }),
      supabase.auth.getUser(),
    ]);
    if (examError || questionError || !examRow || !userData.user) {
      setError(examError?.message ?? questionError?.message ?? "Sesi siswa atau data ujian tidak ditemukan.");
      setLoading(false);
      return;
    }
    const normalizedQuestions: RunnerQuestion[] = (questionRows ?? []).map((row: { question_id: string; body: string; kind: "multiple_choice" | "essay"; options: unknown; weight: number }) => ({
      id: row.question_id,
      text: row.body,
      kind: row.kind,
      options: Array.isArray(row.options) ? row.options.map(String) : [],
      weight: Number(row.weight ?? 1),
    }));
    if (!normalizedQuestions.length) {
      setError("Soal belum dapat dibuka. Pastikan ujian sedang berlangsung dan akun ini telah ditetapkan sebagai peserta.");
      setLoading(false);
      return;
    }
    setExam({ title: examRow.title, subject: relationName(examRow.subjects), className: relationName(examRow.classes), duration: examRow.duration_minutes, fullscreen: examRow.fullscreen_mode, recordTabSwitches: examRow.record_tab_switches ?? true });
    setQuestions(normalizedQuestions);

    const existing = await supabase.from("attempts").select("id,status,started_at").eq("exam_id", examId).eq("student_id", userData.user.id).maybeSingle();
    if (existing.error) {
      setError(existing.error.message);
      setLoading(false);
      return;
    }
    if (["submitted", "grading", "final"].includes(existing.data?.status ?? "")) {
      setError("Jawaban ujian ini sudah dikumpulkan dan tidak dapat diubah lagi.");
      setLoading(false);
      return;
    }
    let attempt = existing.data;
    if (!attempt) {
      const created = await supabase.from("attempts").insert({ exam_id: examId, student_id: userData.user.id, status: "in_progress", started_at: new Date().toISOString() }).select("id,status,started_at").single();
      if (created.error || !created.data) {
        setError(created.error?.message ?? "Percobaan ujian gagal dibuat.");
        setLoading(false);
        return;
      }
      attempt = created.data;
    } else if (attempt.status === "not_started") {
      const startedAt = new Date().toISOString();
      const updated = await supabase.from("attempts").update({ status: "in_progress", started_at: startedAt }).eq("id", attempt.id).select("id,status,started_at").single();
      if (updated.data) attempt = updated.data;
    }
    setAttemptId(attempt.id);
    const elapsed = attempt.started_at ? Math.floor((Date.now() - new Date(attempt.started_at).getTime()) / 1000) : 0;
    setRemaining(Math.max(0, examRow.duration_minutes * 60 - elapsed));

    const { data: savedRows } = await supabase.from("answers").select("question_id,selected_option,essay_text").eq("attempt_id", attempt.id);
    const remoteAnswers = Object.fromEntries((savedRows ?? []).map((row) => [row.question_id, row.essay_text ?? row.selected_option]));
    const localAnswers = loadLocal<Record<string, AnswerValue>>(`answers:${examId}`, {});
    setAnswers({ ...localAnswers, ...remoteAnswers });
    setLoading(false);
  }, [examId]);

  useEffect(() => { void loadExam(); }, [loadExam]);
  useEffect(() => {
    if (loading || error) return;
    const timer = window.setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [loading, error]);

  const answeredCount = questions.filter((question) => {
    const value = answers[question.id];
    return typeof value === "number" || (typeof value === "string" && value.trim().length > 0);
  }).length;
  const question = questions[current] ?? null;

  const persistAnswer = useCallback(async (target: RunnerQuestion, value: AnswerValue) => {
    if (!supabase || !attemptId) return;
    setSyncing(true);
    const timestamp = new Date().toISOString();
    const result = target.kind === "essay"
      ? await supabase.from("answers").upsert({ attempt_id: attemptId, question_id: target.id, essay_text: String(value), selected_option: null, answered_at: timestamp }, { onConflict: "attempt_id,question_id" })
      : await supabase.from("answers").upsert({ attempt_id: attemptId, question_id: target.id, selected_option: Number(value), essay_text: null, answered_at: timestamp }, { onConflict: "attempt_id,question_id" });
    const saveError = result.error;
    setSyncing(false);
    if (saveError) notify("Jawaban tersimpan di perangkat dan akan dicoba lagi.", true);
  }, [attemptId, notify]);

  const updateAnswer = (target: RunnerQuestion, value: AnswerValue, persist = true) => {
    const next = { ...answers, [target.id]: value };
    setAnswers(next);
    saveLocal(`answers:${examId}`, next);
    if (persist) void persistAnswer(target, value);
  };

  useEffect(() => {
    if (!exam?.recordTabSwitches || !attemptId || !supabase) return;
    const handler = () => {
      if (document.hidden) void supabase?.from("integrity_events").insert({ attempt_id: attemptId, event_type: "tab_hidden", metadata: { exam_id: examId } });
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [attemptId, exam?.recordTabSwitches, examId]);

  const finish = useCallback(async () => {
    if (!supabase || !attemptId || finishingRef.current) return;
    finishingRef.current = true;
    setSubmitting(true);
    for (const target of questions) {
      const value = answers[target.id];
      if (value !== undefined) await persistAnswer(target, value);
    }
    const { error: finishError } = await supabase.from("attempts").update({ status: "submitted", submitted_at: new Date().toISOString() }).eq("id", attemptId);
    if (finishError) {
      finishingRef.current = false;
      setSubmitting(false);
      notify(finishError.message, true);
      return;
    }
    localStorage.removeItem(`ruang-ujian:answers:${examId}`);
    notify("Jawaban berhasil dikumpulkan.");
    navigate("/siswa");
  }, [answers, attemptId, examId, navigate, notify, persistAnswer, questions]);

  useEffect(() => {
    if (remaining === 0 && !loading && attemptId) void finish();
  }, [remaining, loading, attemptId, finish]);

  if (loading) return <div className="runner runner-state"><LoaderCircle className="spin" /><h1>Menyiapkan ujian…</h1><p>Mengambil soal dan jawaban tersimpan.</p></div>;
  if (error || !exam || !question) return <div className="runner runner-state"><AlertTriangle /><h1>Ujian belum dapat dibuka</h1><p>{error || "Data ujian tidak ditemukan."}</p><button type="button" onClick={() => navigate("/siswa")}><ArrowLeft /> Kembali ke dashboard</button></div>;

  return (
    <div className="runner">
      <header>
        <div className="runner-brand"><BrandLogo /><span><small>{exam.subject.toUpperCase()} · {exam.className.toUpperCase()}</small><b>{exam.title}</b></span></div>
        <div className="runner-stats"><span className={syncing ? "syncing" : ""}>{syncing ? <WifiOff /> : <Wifi />}{syncing ? "Menyimpan…" : "Tersimpan"}</span><p><small>SISA WAKTU</small><b><Clock3 />{formatTime(remaining)}</b></p><button type="button" onClick={() => setSubmitOpen(true)}>Kumpulkan</button></div>
      </header>
      <main>
        <aside className="question-nav">
          <div><p><b>Daftar Soal</b><span>{answeredCount}/{questions.length} terjawab</span></p><i><span style={{ width: `${(answeredCount / questions.length) * 100}%` }} /></i></div>
          <div className="number-grid">{questions.map((item, index) => { const value = answers[item.id]; const answered = typeof value === "number" || (typeof value === "string" && value.trim()); return <button type="button" key={item.id} className={`${current === index ? "current" : ""} ${answered ? "answered" : ""} ${marked.includes(item.id) ? "marked" : ""}`} onClick={() => setCurrent(index)}>{index + 1}{marked.includes(item.id) && <Star />}</button>; })}</div>
          <ul><li><i className="answered" />Terjawab</li><li><i className="current" />Sedang dibuka</li><li><i className="marked" />Ditandai ragu</li></ul>
          <div className="secure-note"><ShieldCheck /><p><b>Ujian aman</b><span>{exam.recordTabSwitches ? "Aktivitas keluar layar dicatat." : "Jawaban disimpan otomatis."}</span></p></div>
        </aside>
        <section className="question-area">
          <div className="question-top"><span>SOAL {current + 1} DARI {questions.length} · BOBOT {question.weight}</span><button type="button" className={marked.includes(question.id) ? "marked" : ""} onClick={() => setMarked((items) => items.includes(question.id) ? items.filter((id) => id !== question.id) : [...items, question.id])}><Star /> Tandai ragu</button></div>
          <article><h1>{question.text}</h1><p>{question.kind === "essay" ? "Tuliskan jawaban secara jelas pada kolom berikut." : "Pilih satu jawaban yang paling tepat."}</p>
            {question.kind === "multiple_choice" ? <div className="answer-options">{question.options.map((option, index) => <button type="button" key={`${question.id}-${index}`} className={answers[question.id] === index ? "selected" : ""} onClick={() => updateAnswer(question, index)}><span>{String.fromCharCode(65 + index)}</span><b>{option}</b>{answers[question.id] === index && <Check />}</button>)}</div>
              : <textarea className="essay-answer" rows={10} value={typeof answers[question.id] === "string" ? answers[question.id] : ""} onChange={(event) => updateAnswer(question, event.target.value, false)} onBlur={(event) => void persistAnswer(question, event.target.value)} placeholder="Ketik jawaban essay di sini…" />}
          </article>
          <footer><button type="button" disabled={current === 0} onClick={() => setCurrent((value) => value - 1)}><ArrowLeft /> Sebelumnya</button><span>{syncing ? "Menyimpan jawaban…" : "Jawaban tersimpan otomatis"}</span>{current < questions.length - 1 ? <button type="button" className="next" onClick={() => setCurrent((value) => value + 1)}>Selanjutnya <ArrowRight /></button> : <button type="button" className="next" onClick={() => setSubmitOpen(true)}>Tinjau & kumpulkan <Check /></button>}</footer>
        </section>
      </main>
      {submitOpen && <div className="modal-overlay" onMouseDown={() => setSubmitOpen(false)}><div className="modal" onMouseDown={(event) => event.stopPropagation()}><div className="submit-modal"><span><ClipboardCheck /></span><h2>Kumpulkan jawaban?</h2><p>Jawaban tidak dapat diubah setelah dikumpulkan. Soal kosong tetap dapat dikumpulkan.</p><div><span><b>{answeredCount}</b>Terjawab</span><span className="empty"><b>{questions.length - answeredCount}</b>Belum dijawab</span><span className="marked"><b>{marked.length}</b>Ditandai</span></div><footer><button type="button" onClick={() => setSubmitOpen(false)}>Periksa lagi</button><button type="button" className="primary" disabled={submitting} onClick={() => void finish()}>{submitting ? "Mengirim…" : "Ya, kumpulkan"}</button></footer></div></div></div>}
    </div>
  );
}
