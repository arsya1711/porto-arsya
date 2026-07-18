import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileQuestion,
  LayoutDashboard,
  LogOut,
  Plus,
  Radio,
  ShieldCheck,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import { BrandLogo } from "./BrandLogo";
import type { Profile } from "../auth/AuthContext";
import { supabase } from "../lib/supabase";
import type { ExamStatus, StudentExamCatalogRow } from "../types";

type StaffExam = {
  id: string;
  title: string;
  subject: string;
  className: string;
  startsAt: string;
  endsAt: string | null;
  duration: number;
  status: ExamStatus;
  participants: number;
};

type StaffMetrics = {
  activeStudents: number;
  classes: number;
  teachers: number;
  questions: number;
  banks: number;
  pendingGrading: number;
  incidents: number;
  participants: number;
};

type StaffMetricPayload = {
  active_students: number | string;
  classes: number | string;
  teachers: number | string;
  questions: number | string;
  banks: number | string;
  pending_grading: number | string;
  incidents: number | string;
  participants: number | string;
};

type AuditItem = { action: string; created_at: string };

type StudentAttempt = {
  id: string;
  examId: string;
  status: "not_started" | "in_progress" | "submitted" | "grading" | "final";
  finalScore: number | null;
  startedAt: string | null;
  submittedAt: string | null;
};

type StudentExam = StaffExam & {
  questionCount: number;
  attempt: StudentAttempt | null;
};

const EMPTY_METRICS: StaffMetrics = {
  activeStudents: 0,
  classes: 0,
  teachers: 0,
  questions: 0,
  banks: 0,
  pendingGrading: 0,
  incidents: 0,
  participants: 0,
};

function relationName(value: unknown): string {
  if (Array.isArray(value)) return String(value[0]?.name ?? "—");
  if (value && typeof value === "object" && "name" in value) {
    return String(value.name);
  }
  return "—";
}

function relationCount(value: unknown): number {
  return Array.isArray(value) ? Number(value[0]?.count ?? 0) : 0;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function todayLabel() {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
    .format(new Date())
    .toUpperCase();
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function relativeTime(value: string) {
  const delta = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(delta / 60_000));
  if (minutes < 1) return "Baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return shortDate(value);
}

function deriveExamStatus(
  stored: ExamStatus,
  startsAt: string,
  endsAt: string | null,
  duration: number,
): ExamStatus {
  if (stored === "draft") return "draft";
  const now = Date.now();
  const start = new Date(startsAt).getTime();
  const end = endsAt ? new Date(endsAt).getTime() : start + duration * 60_000;
  if (now < start) return "terjadwal";
  if (now <= end) return "berlangsung";
  return "selesai";
}

function currentExamStatus(exam: StaffExam): ExamStatus {
  return deriveExamStatus(
    exam.status,
    exam.startsAt,
    exam.endsAt,
    exam.duration,
  );
}

function useDashboardClock() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function auditText(action: string) {
  const labels: Record<string, string> = {
    "user.created": "Akun pengguna baru dibuat",
    "user.updated": "Data pengguna diperbarui",
    "user.deleted": "Akun pengguna dihapus",
    "user.activated": "Akun pengguna diaktifkan",
    "user.deactivated": "Akun pengguna dinonaktifkan",
    "user.password_reset": "Kata sandi pengguna direset",
  };
  return labels[action] ?? action.replace(/\./g, " ");
}

function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
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

function Metric({
  icon,
  tone,
  label,
  value,
  note,
}: {
  icon: ReactNode;
  tone: string;
  label: string;
  value: number;
  note: string;
}) {
  return (
    <div className="stat-card">
      <span className={tone}>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <p>{note}</p>
      </div>
    </div>
  );
}

function CardHead({ title, to }: { title: string; to?: string }) {
  return (
    <div className="card-head">
      <h2>{title}</h2>
      {to && <Link to={to}>Lihat semua</Link>}
    </div>
  );
}

function Status({ value }: { value: ExamStatus }) {
  const labels: Record<ExamStatus, string> = {
    draft: "Draft",
    terjadwal: "Terjadwal",
    berlangsung: "Berlangsung",
    selesai: "Selesai",
  };
  return (
    <span className={`status ${value}`}>
      <i /> {labels[value]}
    </span>
  );
}

export function StaffDashboard({ profile }: { profile: Profile }) {
  useDashboardClock();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exams, setExams] = useState<StaffExam[]>([]);
  const [metrics, setMetrics] = useState<StaffMetrics>(EMPTY_METRICS);
  const [audits, setAudits] = useState<AuditItem[]>([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!supabase) {
        setError("Supabase belum dikonfigurasi.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");

      let examQuery = supabase
        .from("exams")
        .select(
          "id,title,starts_at,ends_at,duration_minutes,status,created_by,subjects(name),classes(name),exam_assignments(count)",
        )
        .order("starts_at", { ascending: false })
        .limit(30);
      if (profile.role === "guru") {
        examQuery = examQuery.eq("created_by", profile.id);
      }

      const [examResult, metricResult, auditResult] = await Promise.all([
        examQuery,
        supabase.rpc("get_staff_dashboard_metrics").single(),
        profile.role === "admin"
          ? supabase
              .from("audit_logs")
              .select("action,created_at")
              .order("created_at", { ascending: false })
              .limit(5)
          : Promise.resolve({ data: [] as AuditItem[], error: null }),
      ]);

      const firstError = [
        examResult.error,
        metricResult.error,
        auditResult.error,
      ].find(Boolean);
      if (!active) return;
      if (firstError) {
        setError(firstError.message);
        setLoading(false);
        return;
      }

      const normalizedExams: StaffExam[] = (examResult.data ?? []).map(
        (row) => ({
          id: row.id,
          title: row.title,
          subject: relationName(row.subjects),
          className: relationName(row.classes),
          startsAt: row.starts_at,
          endsAt: row.ends_at,
          duration: row.duration_minutes,
          status: deriveExamStatus(
            row.status as ExamStatus,
            row.starts_at,
            row.ends_at,
            row.duration_minutes,
          ),
          participants: relationCount(row.exam_assignments),
        }),
      );
      const metricData = metricResult.data as StaffMetricPayload | null;

      setExams(normalizedExams);
      setMetrics({
        activeStudents: Number(metricData?.active_students ?? 0),
        classes: Number(metricData?.classes ?? 0),
        teachers: Number(metricData?.teachers ?? 0),
        questions: Number(metricData?.questions ?? 0),
        banks: Number(metricData?.banks ?? 0),
        pendingGrading: Number(metricData?.pending_grading ?? 0),
        incidents: Number(metricData?.incidents ?? 0),
        participants: Number(metricData?.participants ?? 0),
      });
      setAudits((auditResult.data ?? []) as AuditItem[]);
      setLoading(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, [profile.id, profile.role]);

  const liveExams = exams.filter(
    (exam) => currentExamStatus(exam) === "berlangsung",
  );
  const upcomingExams = exams
    .filter((exam) =>
      ["berlangsung", "terjadwal"].includes(currentExamStatus(exam)),
    )
    .sort(
      (left, right) =>
        new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
    )
    .slice(0, 4);
  const examStatusCounts = {
    draft: exams.filter((exam) => currentExamStatus(exam) === "draft").length,
    terjadwal: exams.filter((exam) => currentExamStatus(exam) === "terjadwal")
      .length,
    berlangsung: liveExams.length,
    selesai: exams.filter((exam) => currentExamStatus(exam) === "selesai")
      .length,
  };

  const staffMetrics =
    profile.role === "admin"
      ? [
          {
            icon: <Radio />,
            tone: "green",
            label: "Ujian berlangsung",
            value: liveExams.length,
            note: `${liveExams.reduce((sum, exam) => sum + exam.participants, 0)} peserta terdaftar`,
          },
          {
            icon: <Users />,
            tone: "blue",
            label: "Guru aktif",
            value: metrics.teachers,
            note: "Tenaga pengajar terdaftar",
          },
          {
            icon: <ShieldCheck />,
            tone: "amber",
            label: "Insiden minggu ini",
            value: metrics.incidents,
            note: "Event integritas tercatat",
          },
          {
            icon: <Users />,
            tone: "purple",
            label: "Siswa aktif",
            value: metrics.activeStudents,
            note: `${metrics.classes} kelas · ${metrics.teachers} guru`,
          },
        ]
      : [
          {
            icon: <CalendarDays />,
            tone: "green",
            label: "Ujian saya",
            value: exams.length,
            note: `${liveExams.length} sedang berlangsung`,
          },
          {
            icon: <FileQuestion />,
            tone: "blue",
            label: "Soal aktif",
            value: metrics.questions,
            note: `${metrics.banks} bank soal`,
          },
          {
            icon: <Clock3 />,
            tone: "amber",
            label: "Menunggu koreksi",
            value: metrics.pendingGrading,
            note: "Attempt pada ujian Anda",
          },
          {
            icon: <Users />,
            tone: "purple",
            label: "Total penugasan",
            value: metrics.participants,
            note: `${metrics.incidents} insiden minggu ini`,
          },
        ];

  return (
    <div className="portal-page real-dashboard">
      <PageTitle
        eyebrow={todayLabel()}
        title={profile.full_name}
        description={
          profile.role === "admin"
            ? "Ringkasan operasional sekolah berdasarkan data Supabase."
            : "Ringkasan ujian dan konten yang Anda kelola."
        }
        action={
          <Link
            className="primary"
            to={profile.role === "admin" ? "/app/kelas" : "/app/ujian"}
          >
            <Plus /> {profile.role === "admin" ? "Kelola siswa" : "Buat ujian"}
          </Link>
        }
      />

      {error && (
        <div className="dashboard-error">
          <AlertTriangle />
          {error}
        </div>
      )}
      <div className="stats-grid">
        {staffMetrics.map((metric) => (
          <Metric
            {...metric}
            key={metric.label}
            value={loading ? 0 : metric.value}
          />
        ))}
      </div>

      <div className="dashboard-columns">
        <section className="card">
          <CardHead
            title="Jadwal terdekat"
            to={profile.role === "admin" ? "/app/laporan" : "/app/ujian"}
          />
          <div className="schedule-list">
            {loading ? (
              <DashboardEmpty text="Memuat jadwal…" />
            ) : upcomingExams.length ? (
              upcomingExams.map((exam) => (
                <div key={exam.id}>
                  <div className="date-tile">
                    <strong>{timeLabel(exam.startsAt)}</strong>
                    <span>{shortDate(exam.startsAt)}</span>
                  </div>
                  <span className="subject-dot">
                    {exam.subject.slice(0, 2).toUpperCase() || "UJ"}
                  </span>
                  <div className="schedule-copy">
                    <strong>{exam.title}</strong>
                    <small>
                      {exam.subject} · {exam.className} · {exam.participants}{" "}
                      peserta
                    </small>
                  </div>
                  <Status value={currentExamStatus(exam)} />
                </div>
              ))
            ) : (
              <DashboardEmpty text="Belum ada ujian terjadwal." />
            )}
          </div>
        </section>

        <section className="card">
          <CardHead
            title={
              profile.role === "admin" ? "Aktivitas terbaru" : "Ujian terbaru"
            }
          />
          <div className="activity-list real-activity-list">
            {loading ? (
              <DashboardEmpty text="Memuat aktivitas…" />
            ) : profile.role === "admin" && audits.length ? (
              audits.map((audit, index) => (
                <div className="activity" key={`${audit.created_at}-${index}`}>
                  <span>
                    <LayoutDashboard />
                  </span>
                  <p>
                    {auditText(audit.action)}
                    <small>{relativeTime(audit.created_at)}</small>
                  </p>
                </div>
              ))
            ) : exams.length ? (
              exams.slice(0, 5).map((exam) => (
                <div className="activity" key={exam.id}>
                  <span>
                    <CalendarDays />
                  </span>
                  <p>
                    <b>{exam.title}</b>
                    <small>
                      {exam.subject} · {shortDate(exam.startsAt)}
                    </small>
                  </p>
                </div>
              ))
            ) : (
              <DashboardEmpty text="Belum ada aktivitas untuk ditampilkan." />
            )}
          </div>
        </section>
      </div>

      <section className="card dashboard-status-card">
        <div>
          <p>STATUS UJIAN {profile.role === "guru" ? "ANDA" : "SEKOLAH"}</p>
          <strong>{exams.length}</strong>
          <span>Total ujian yang tersimpan di Supabase</span>
        </div>
        <div className="dashboard-status-grid">
          {Object.entries(examStatusCounts).map(([status, count]) => (
            <div key={status}>
              <Status value={status as ExamStatus} />
              <b>{count}</b>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function DashboardEmpty({ text }: { text: string }) {
  return <div className="dashboard-empty">{text}</div>;
}

export function StudentDashboard({
  profile,
  logout,
}: {
  profile: Profile;
  logout: () => void;
}) {
  const now = useDashboardClock();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [className, setClassName] = useState("Belum ada kelas");
  const [exams, setExams] = useState<StudentExam[]>([]);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const markOnline = () => setOnline(true);
    const markOffline = () => setOnline(false);
    window.addEventListener("online", markOnline);
    window.addEventListener("offline", markOffline);
    return () => {
      window.removeEventListener("online", markOnline);
      window.removeEventListener("offline", markOffline);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!supabase) {
        setError("Supabase belum dikonfigurasi.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      const [membershipResult, catalogResult, attemptResult] =
        await Promise.all([
          supabase
            .from("class_students")
            .select("classes(name)")
            .eq("student_id", profile.id)
            .maybeSingle(),
          supabase.rpc("get_student_exam_catalog"),
          supabase
            .from("attempts")
            .select("id,exam_id,status,final_score,started_at,submitted_at")
            .eq("student_id", profile.id),
        ]);
      const firstError = [
        membershipResult.error,
        catalogResult.error,
        attemptResult.error,
      ].find(Boolean);
      if (!active) return;
      if (firstError) {
        setError(firstError.message);
        setLoading(false);
        return;
      }

      const attempts: StudentAttempt[] = (attemptResult.data ?? []).map(
        (row) => ({
          id: row.id,
          examId: row.exam_id,
          status: row.status,
          finalScore: row.final_score === null ? null : Number(row.final_score),
          startedAt: row.started_at,
          submittedAt: row.submitted_at,
        }),
      );
      const normalizedExams = ((catalogResult.data ?? []) as StudentExamCatalogRow[])
        .map((rawExam) => {
          const duration = Number(rawExam.duration_minutes);
          return {
            id: rawExam.exam_id,
            title: rawExam.title,
            subject: rawExam.subject_name ?? "Mata pelajaran",
            className: rawExam.class_name ?? "Belum ada kelas",
            startsAt: rawExam.starts_at,
            endsAt: rawExam.ends_at,
            duration,
            status: deriveExamStatus(
              rawExam.status as ExamStatus,
              rawExam.starts_at,
              rawExam.ends_at,
              duration,
            ),
            participants: 0,
            questionCount: Number(rawExam.question_count ?? 0),
            attempt:
              attempts.find((attempt) => attempt.examId === rawExam.exam_id) ??
              null,
          } satisfies StudentExam;
        })
        .filter((exam) => exam.status !== "draft");

      setClassName(relationName(membershipResult.data?.classes));
      setExams(normalizedExams);
      setLoading(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, [profile.id]);

  const available = exams
    .filter(
      (exam) =>
        currentExamStatus(exam) === "berlangsung" &&
        !["submitted", "grading", "final"].includes(exam.attempt?.status ?? ""),
    )
    .sort(
      (left, right) =>
        new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
    );
  const upcoming = exams
    .filter((exam) => new Date(exam.startsAt).getTime() > now)
    .sort(
      (left, right) =>
        new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
    );
  const results = exams
    .filter((exam) =>
      ["submitted", "grading", "final"].includes(exam.attempt?.status ?? ""),
    )
    .sort(
      (left, right) =>
        new Date(right.attempt?.submittedAt ?? right.startsAt).getTime() -
        new Date(left.attempt?.submittedAt ?? left.startsAt).getTime(),
    );
  const featured = available[0] ?? null;

  return (
    <div className="student-app">
      <header className="student-header">
        <Link to="/siswa" className="student-logo">
          <BrandLogo /> <b>AWExam</b>
        </Link>
        <div>
          <span className={online ? "" : "offline"}>
            {online ? <Wifi /> : <WifiOff />}
            {online ? "Online" : "Offline"}
          </span>
          <button aria-label="Notifikasi">
            <Bell />
          </button>
          <button className="student-profile">
            <span>{getInitials(profile.full_name)}</span>
            <b>
              {profile.full_name}
              <small>
                {className} · {profile.student_number ?? "NIS belum diisi"}
              </small>
            </b>
            <ChevronDown />
          </button>
          <button className="logout-icon" onClick={logout} aria-label="Keluar">
            <LogOut />
          </button>
        </div>
      </header>

      <main className="student-home real-student-home">
        <div className="student-greeting">
          <p>{todayLabel()}</p>
          <h1>
            {profile.full_name}
          </h1>
          <span>Siapkan dirimu dan kerjakan ujian dengan jujur.</span>
        </div>

        {error && (
          <div className="dashboard-error">
            <AlertTriangle />
            {error}
          </div>
        )}
        {loading ? (
          <section className="available-exam student-empty-state">
            <Clock3 />
            <h2>Memuat dashboard siswa…</h2>
          </section>
        ) : featured ? (
          <section className="available-exam">
            <div className="live-label">
              <i /> TERSEDIA SEKARANG
            </div>
            <div className="exam-feature">
              <div className="feature-icon">
                <BookOpen />
              </div>
              <div className="feature-copy">
                <span>
                  {featured.subject.toUpperCase()} ·{" "}
                  {featured.className.toUpperCase()}
                </span>
                <h2>{featured.title}</h2>
                <p>
                  <Clock3 /> {featured.duration} menit <i />
                  <FileQuestion /> {featured.questionCount} soal <i />
                  {featured.endsAt
                    ? `Berakhir ${timeLabel(featured.endsAt)}`
                    : "Sesuai durasi ujian"}
                </p>
              </div>
              <Link to={`/siswa/ujian/${featured.id}`} className="start-button">
                {featured.attempt?.status === "in_progress"
                  ? "Lanjutkan"
                  : "Mulai ujian"}
                <ArrowRight />
              </Link>
            </div>
            <div className="exam-note">
              <ShieldCheck />
              <p>
                <b>Mode ujian aman aktif</b>
                <span>Aktivitas keluar dari halaman ujian akan dicatat.</span>
              </p>
            </div>
          </section>
        ) : (
          <section className="available-exam student-empty-state">
            <CheckCircle2 />
            <h2>Tidak ada ujian yang tersedia saat ini</h2>
            <p>
              Ujian akan muncul otomatis sesuai jadwal dan penugasan dari guru.
            </p>
          </section>
        )}

        <div className="student-columns">
          <section>
            <h3>AKAN DATANG</h3>
            {upcoming.length ? (
              upcoming.slice(0, 5).map((exam) => (
                <div className="upcoming-card" key={exam.id}>
                  <span className="subject-box blue">
                    {exam.subject.slice(0, 2).toUpperCase()}
                  </span>
                  <p>
                    <b>{exam.title}</b>
                    <small>
                      {exam.subject} · {exam.questionCount} soal ·{" "}
                      {exam.duration} menit
                    </small>
                  </p>
                  <div>
                    <b>{shortDate(exam.startsAt)}</b>
                    <span>{timeLabel(exam.startsAt)}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="student-list-empty">
                Belum ada ujian mendatang.
              </div>
            )}
          </section>

          <section>
            <h3>HASIL TERBARU</h3>
            {results.length ? (
              results.slice(0, 5).map((exam) => (
                <div className="result-card" key={exam.id}>
                  <div>
                    <span className="subject-box purple">
                      {exam.subject.slice(0, 2).toUpperCase()}
                    </span>
                    <p>
                      <b>{exam.title}</b>
                      <small>
                        {exam.attempt?.submittedAt
                          ? shortDate(exam.attempt.submittedAt)
                          : "Menunggu submit"}
                      </small>
                    </p>
                  </div>
                  {exam.attempt?.finalScore === null ? (
                    <span className="grading-badge">Menunggu nilai</span>
                  ) : (
                    <>
                      <strong>
                        {exam.attempt?.finalScore}
                        <small> nilai</small>
                      </strong>
                      <span className="passed">Final</span>
                    </>
                  )}
                </div>
              ))
            ) : (
              <div className="student-list-empty">Belum ada hasil ujian.</div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
