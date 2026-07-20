import {
  ComponentProps,
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Download,
  Eye,
  EyeOff,
  FileQuestion,
  Filter,
  GraduationCap,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Star,
  Trash2,
  UserPlus,
  UserRound,
  Users,
  Wifi,
  X,
} from "lucide-react";
import { type Exam, type Role, type StudentExamCatalogRow } from "./types";
import {
  isSupabaseConfigured,
  loadLocal,
  saveLocal,
  supabase,
} from "./lib/supabase";
import { AuthProvider, type Profile, useAuth } from "./auth/AuthContext";
import { QuestionBank } from "./components/QuestionBank";
import { StaffDashboard, StudentDashboard } from "./components/Dashboards";
import {
  AcademicYearsPage,
  AuditSecurityPage,
  SubjectsPage,
} from "./components/AdminPages";
import {
  RealExamManagement,
  RealGrading,
  RealReports,
} from "./components/AssessmentPages";
import { RealSettingsPage } from "./components/SettingsPage";
import { PortalTopbar } from "./components/PortalTopbar";
import { BrandLogo } from "./components/BrandLogo";

type Toast = { text: string; error?: boolean } | null;

function App() {
  return (
    <AuthProvider>
      <Application />
    </AuthProvider>
  );
}

function Application() {
  const {
    profile,
    loading: authLoading,
    logout,
    passwordRecovery,
    updatePassword,
  } = useAuth();
  const [toast, setToast] = useState<Toast>(null);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(id);
  }, [toast]);

  const notify = useCallback(
    (text: string, error = false) => setToast({ text, error }),
    [],
  );
  if (!isSupabaseConfigured) {
    return (
      <main className="auth-loading">
        <span><AlertTriangle /></span>
        <h1>Konfigurasi server belum tersedia</h1>
        <p>Administrator harus mengatur VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY sebelum aplikasi digunakan.</p>
      </main>
    );
  }
  if (authLoading)
    return (
      <div className="auth-loading">
        <span>
          <BrandLogo />
        </span>
        <p>Memuat sesi pengguna…</p>
      </div>
    );
  if (passwordRecovery)
    return <PasswordRecovery updatePassword={updatePassword} notify={notify} />;
  const role = profile?.role ?? null;

  return (
    <>
      <Routes>
        <Route
          path="/"
          element={
            profile ? (
              <Navigate to={role === "siswa" ? "/siswa" : "/app"} />
            ) : (
              <Login notify={notify} />
            )
          }
        />
        <Route
          path="/app/*"
          element={
            profile && role !== "siswa" ? (
              <Portal
                profile={profile}
                logout={logout}
                notify={notify}
              />
            ) : (
              <Navigate to="/" />
            )
          }
        />
        <Route
          path="/siswa"
          element={
            profile && role === "siswa" ? (
              <StudentDashboard profile={profile} logout={logout} />
            ) : (
              <Navigate to="/" />
            )
          }
        />
        <Route
          path="/siswa/ujian/:examId"
          element={
            role === "siswa" ? (
              <ExamRunner notify={notify} />
            ) : (
              <Navigate to="/" />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      {toast && (
        <div className={`toast ${toast.error ? "error" : ""}`}>
          {toast.error ? <AlertTriangle /> : <CheckCircle2 />}
          {toast.text}
        </div>
      )}
    </>
  );
}

function PasswordRecovery({
  updatePassword,
  notify,
}: {
  updatePassword: (password: string) => Promise<void>;
  notify: (text: string, error?: boolean) => void;
}) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 8) {
      notify("Kata sandi minimal 8 karakter.", true);
      return;
    }
    if (password !== confirmation) {
      notify("Konfirmasi kata sandi tidak sesuai.", true);
      return;
    }
    setLoading(true);
    try {
      await updatePassword(password);
      notify("Kata sandi berhasil diperbarui.");
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Gagal memperbarui kata sandi.",
        true,
      );
    } finally {
      setLoading(false);
    }
  };
  return (
    <main className="recovery-page">
      <form onSubmit={submit}>
        <span className="recovery-icon">
          <LockKeyhole />
        </span>
        <p className="overline">KEAMANAN AKUN</p>
        <h1>Buat kata sandi baru</h1>
        <p>
          Gunakan minimal 8 karakter dan jangan gunakan kata sandi yang mudah
          ditebak.
        </p>
        <FormField label="Kata sandi baru">
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </FormField>
        <FormField label="Konfirmasi kata sandi">
          <PasswordInput
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            minLength={8}
            required
          />
        </FormField>
        <button className="login-button" disabled={loading}>
          {loading ? "Menyimpan…" : "Simpan kata sandi"}
          <ArrowRight />
        </button>
      </form>
    </main>
  );
}

function relationName(value: unknown): string {
  if (Array.isArray(value)) return String(value[0]?.name ?? "—");
  if (value && typeof value === "object" && "name" in value)
    return String(value.name);
  return "—";
}
function capitalize(value: string) {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

function Login({
  notify,
}: {
  notify: (text: string, error?: boolean) => void;
}) {
  const { login, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const nextProfile = await login(email, password);
      navigate(nextProfile.role === "siswa" ? "/siswa" : "/app");
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Email atau kata sandi tidak sesuai.",
        true,
      );
    } finally {
      setLoading(false);
    }
  };
  const forgotPassword = async () => {
    if (!email) {
      notify("Masukkan email terlebih dahulu.", true);
      return;
    }
    try {
      await resetPassword(email);
      notify("Tautan reset kata sandi sudah dikirim.");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Gagal mengirim tautan reset.",
        true,
      );
    }
  };
  return (
    <main className="login-page">
      <section className="login-brand">
        <div className="login-school-brand">
          <div className="school-mark">
            <BrandLogo />
          </div>
          <span>Mts Alhidayah Wattaqwa</span>
        </div>
        <div className="brand-copy">
          <span>AWEXAM</span>
          <h1>
            Ujian lebih tertib.
            <br />
            Hasil lebih cepat.
          </h1>
          <p>
            Satu ruang digital untuk mengelola ujian sekolah, dari penyusunan
            soal hingga laporan nilai.
          </p>
        </div>
        <div className="login-art">
          <div className="art-card">
            <span>
              <BookOpen /> 1.248 soal
            </span>
            <strong>
              Bank soal yang tumbuh
              <br />
              bersama sekolah Anda.
            </strong>
            <div className="art-bars">
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>
        </div>
        <small>© 2026 AWExam</small>
      </section>
      <section className="login-panel">
        <form onSubmit={submit}>
          <div className="mobile-logo">
            <BrandLogo />
            <span>
              AWExam
              <small>Mts Alhidayah Wattaqwa</small>
            </span>
          </div>
          <p className="overline">PORTAL SEKOLAH</p>
          <h2>Selamat datang</h2>
          <p className="subcopy">
            Masuk menggunakan akun yang diberikan oleh admin sekolah.
          </p>
          <label>
            <span>Email</span>
            <div className="input-box">
              <UserRound />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
          </label>
          <label>
            <span>Kata sandi</span>
            <div className="input-box">
              <LockKeyhole />
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
          </label>
          <div className="login-help">
            <label>
              <input type="checkbox" defaultChecked /> Ingat saya
            </label>
            <button type="button" onClick={forgotPassword}>
              Lupa kata sandi?
            </button>
          </div>
          <button className="login-button" disabled={loading}>
            {loading ? "Memeriksa…" : "Masuk"}
            <ArrowRight />
          </button>
          <p className="connection">
            <i className={isSupabaseConfigured ? "online" : ""} />
            {isSupabaseConfigured
              ? "Autentikasi Supabase aktif"
              : "Konfigurasi server belum tersedia"}
          </p>
        </form>
      </section>
    </main>
  );
}

function Portal({
  profile,
  logout,
  notify,
}: {
  profile: Profile;
  logout: () => void;
  notify: (text: string, error?: boolean) => void;
}) {
  const location = useLocation();
  const role = profile.role;
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [schoolBrand, setSchoolBrand] = useState({ name: "Portal Sekolah", logoUrl: "" });
  useEffect(() => {
    const loadBrand = async () => {
      if (!supabase) return;
      const { data } = await supabase.from("school_profile_settings").select("school_name,logo_url").eq("id", 1).maybeSingle();
      if (data) setSchoolBrand({ name: data.school_name || "Portal Sekolah", logoUrl: data.logo_url || "" });
    };
    void loadBrand();
    window.addEventListener("school-settings-updated", loadBrand);
    return () => window.removeEventListener("school-settings-updated", loadBrand);
  }, []);
  useEffect(() => {
    let timeoutMinutes = 120;
    let timeoutId = 0;
    const resetTimer = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => void logout(), timeoutMinutes * 60_000);
    };
    const loadTimeout = async () => {
      if (supabase) {
        const { data } = await supabase.from("school_profile_settings").select("session_timeout_minutes").eq("id", 1).maybeSingle();
        timeoutMinutes = data?.session_timeout_minutes ?? 120;
      }
      resetTimer();
    };
    const events: (keyof WindowEventMap)[] = ["mousedown", "keydown", "touchstart"];
    events.forEach((event) => window.addEventListener(event, resetTimer, { passive: true }));
    window.addEventListener("school-settings-updated", loadTimeout);
    void loadTimeout();
    return () => {
      window.clearTimeout(timeoutId);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
      window.removeEventListener("school-settings-updated", loadTimeout);
    };
  }, [logout]);
  const teacherNav: [string, ReactNode, string][] = [
    ["/app", <LayoutDashboard />, "Ringkasan"],
    ["/app/ujian", <CalendarDays />, "Ujian"],
    ["/app/bank-soal", <FileQuestion />, "Bank Soal"],
    ["/app/kelas", <Users />, "Kelas & Siswa"],
    ["/app/koreksi", <ClipboardCheck />, "Koreksi"],
    ["/app/laporan", <BarChart3 />, "Laporan"],
  ];
  const adminNav: [string, ReactNode, string][] = [
    ["/app", <LayoutDashboard />, "Ringkasan"],
    ["/app/tahun-ajaran", <CalendarDays />, "Tahun Ajaran"],
    ["/app/mata-pelajaran", <BookOpen />, "Mata Pelajaran"],
    ["/app/kelas", <Users />, "Kelas & Siswa"],
    ["/app/guru", <UserRound />, "Guru"],
    ["/app/admin", <ShieldCheck />, "Administrator"],
    ["/app/laporan", <BarChart3 />, "Laporan Sekolah"],
    ["/app/audit", <LockKeyhole />, "Audit & Keamanan"],
  ];
  const nav = role === "admin" ? adminNav : teacherNav;
  useEffect(() => setMobileNavigationOpen(false), [location.pathname]);
  useEffect(() => {
    if (!mobileNavigationOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNavigationOpen(false);
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileNavigationOpen]);
  useEffect(() => {
    let animation: { kill: () => void } | undefined;
    let cancelled = false;
    const target = document.querySelector(".portal-page");
    if (!target || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    void import("gsap").then(({ gsap }) => {
      if (!cancelled) animation = gsap.fromTo(target, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.38, ease: "power2.out" });
    });
    return () => { cancelled = true; animation?.kill(); };
  }, [location.pathname]);
  return (
    <div className="portal-shell">
      {mobileNavigationOpen && (
        <button
          type="button"
          className="mobile-nav-overlay"
          aria-label="Tutup navigasi"
          onClick={() => setMobileNavigationOpen(false)}
        />
      )}
      <aside className={`portal-sidebar${mobileNavigationOpen ? " mobile-open" : ""}`} aria-label="Navigasi utama">
        {mobileNavigationOpen && (
          <button
            type="button"
            className="mobile-nav-close"
            aria-label="Tutup navigasi"
            autoFocus
            onClick={() => setMobileNavigationOpen(false)}
          >
            <X />
          </button>
        )}
        <Link to="/app" className="portal-logo" onClick={() => setMobileNavigationOpen(false)}>
          <span>
            {schoolBrand.logoUrl ? <img src={schoolBrand.logoUrl} alt="Logo sekolah" /> : <BrandLogo />}
          </span>
          <b>
            AWExam<small>{schoolBrand.name}</small>
          </b>
        </Link>
        <nav>
          {nav.map(([to, icon, label]) => (
            <Link
              key={to}
              className={location.pathname === to ? "active" : ""}
              to={to}
              onClick={() => setMobileNavigationOpen(false)}
            >
              {icon}
              {label}
            </Link>
          ))}
        </nav>
        <div className="side-bottom">
          <Link to="/app/pengaturan" onClick={() => setMobileNavigationOpen(false)}>
            <Settings />
            Pengaturan
          </Link>
          <button onClick={() => { setMobileNavigationOpen(false); void logout(); }}>
            <LogOut />
            Keluar
          </button>
        </div>
      </aside>
      <main className="portal-main">
        <Topbar profile={profile} logout={logout} onOpenNavigation={() => setMobileNavigationOpen(true)} />
        <Routes>
          <Route index element={<StaffDashboard profile={profile} />} />
          <Route
            path="ujian"
            element={role === "guru" ? (
              <RealExamManagement notify={notify} />
            ) : <Navigate to="/app" />}
          />
          <Route
            path="bank-soal"
            element={
              role === "guru" ? (
                <QuestionBank notify={notify} />
              ) : (
                <Navigate to="/app" />
              )
            }
          />
          <Route
            path="kelas"
            element={
              <UserManagement
                notify={notify}
                roleFilter="siswa"
                title="Kelas & Siswa"
                description="Kelola akun siswa dan data peserta didik."
                canManage={role === "admin"}
              />
            }
          />
          <Route
            path="guru"
            element={
              role === "admin" ? (
                <UserManagement
                  notify={notify}
                  roleFilter="guru"
                  title="Guru"
                  description="Kelola akun dan akses tenaga pengajar."
                  canManage
                />
              ) : (
                <Navigate to="/app" />
              )
            }
          />
          <Route
            path="admin"
            element={
              role === "admin" ? (
                <UserManagement
                  notify={notify}
                  roleFilter="admin"
                  title="Administrator"
                  description="Kelola akun dengan akses administrasi penuh."
                  canManage
                />
              ) : (
                <Navigate to="/app" />
              )
            }
          />
          <Route
            path="tahun-ajaran"
            element={
              role === "admin" ? (
                <AcademicYearsPage notify={notify} />
              ) : (
                <Navigate to="/app" />
              )
            }
          />
          <Route
            path="mata-pelajaran"
            element={
              role === "admin" ? (
                <SubjectsPage notify={notify} />
              ) : (
                <Navigate to="/app" />
              )
            }
          />
          <Route
            path="audit"
            element={
              role === "admin" ? (
                <AuditSecurityPage notify={notify} />
              ) : (
                <Navigate to="/app" />
              )
            }
          />
          <Route
            path="koreksi"
            element={role === "guru" ? <RealGrading notify={notify} /> : <Navigate to="/app" />}
          />
          <Route path="laporan" element={<RealReports />} />
          <Route path="pengaturan" element={<RealSettingsPage profile={profile} notify={notify} />} />
          <Route path="*" element={<Navigate to="/app" />} />
        </Routes>
      </main>
      <MobilePortalNav role={role} />
    </div>
  );
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
function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number)[][],
) {
  const escape = (value: string | number) =>
    `"${String(value).replace(/"/g, '""')}"`;
  const csv = [headers, ...rows]
    .map((row) => row.map(escape).join(","))
    .join("\n");
  const url = URL.createObjectURL(
    new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
function Topbar({
  profile,
  logout,
  onOpenNavigation,
}: {
  profile: Profile;
  logout: () => void;
  onOpenNavigation: () => void;
}) {
  return <PortalTopbar profile={profile} logout={logout} onOpenNavigation={onOpenNavigation} />;
}

function MobilePortalNav({ role }: { role: Role }) {
  const items =
    role === "admin"
      ? [
          ["/app", <LayoutDashboard />, "Beranda"],
          ["/app/kelas", <Users />, "Siswa"],
          ["/app/guru", <UserRound />, "Guru"],
          ["/app/audit", <ShieldCheck />, "Audit"],
        ]
      : [
          ["/app", <LayoutDashboard />, "Beranda"],
          ["/app/ujian", <CalendarDays />, "Ujian"],
          ["/app/bank-soal", <FileQuestion />, "Soal"],
          ["/app/kelas", <Users />, "Kelas"],
        ];
  return (
    <nav className="portal-mobile-nav">
      {items.map(([to, icon, label]) => (
        <Link to={to as string} key={to as string}>
          {icon}
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
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

function CardHead({ title, link }: { title: string; link?: string }) {
  return (
    <div className="card-head">
      <h2>{title}</h2>
      {link && (
        <button>
          {link}
          <ChevronRight />
        </button>
      )}
    </div>
  );
}
function Status({ value }: { value: Exam["status"] }) {
  const labels = {
    draft: "Draft",
    terjadwal: "Terjadwal",
    berlangsung: "Berlangsung",
    selesai: "Selesai",
  };
  return (
    <span className={`status ${value}`}>
      <i />
      {labels[value]}
    </span>
  );
}
type ExamDraft = Exam & {
  subjectId?: string;
  classId?: string;
  startsAt?: string;
  accessCode?: string;
  shuffleQuestions?: boolean;
  fullscreenMode?: boolean;
  questionIds?: string[];
};

// Legacy demo implementation retained temporarily for visual reference.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ExamManagement({
  exams,
  setExams,
  notify,
}: {
  exams: Exam[];
  setExams: (v: Exam[]) => void;
  notify: (text: string, error?: boolean) => void;
}) {
  const [create, setCreate] = useState(false);
  const [query, setQuery] = useState("");
  const filteredExams = exams.filter((exam) =>
    [exam.title, exam.subject, exam.className, exam.status]
      .join(" ")
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  const exportExams = () => {
    downloadCsv(
      "daftar-ujian.csv",
      [
        "Judul",
        "Mata pelajaran",
        "Kelas",
        "Tanggal",
        "Waktu",
        "Durasi",
        "Peserta",
        "Status",
      ],
      filteredExams.map((exam) => [
        exam.title,
        exam.subject,
        exam.className,
        exam.date,
        exam.time,
        exam.duration,
        exam.participants,
        exam.status,
      ]),
    );
    notify("Daftar ujian berhasil diekspor");
  };
  const advanceStatus = async (exam: Exam) => {
    const nextStatus: Record<Exam["status"], Exam["status"]> = {
      draft: "terjadwal",
      terjadwal: "berlangsung",
      berlangsung: "selesai",
      selesai: "selesai",
    };
    const status = nextStatus[exam.status];
    if (status === exam.status) {
      notify("Ujian ini sudah selesai");
      return;
    }
    try {
      if (supabase) {
        const { error } = await supabase
          .from("exams")
          .update({ status })
          .eq("id", exam.id);
        if (error) throw error;
      }
      setExams(exams.map((item) => item.id === exam.id ? { ...item, status } : item));
      notify(`Status ujian diubah menjadi ${status}`);
    } catch {
      notify("Status ujian gagal diperbarui", true);
    }
  };
  const addExam = async (exam: ExamDraft) => {
    try {
      if (supabase) {
        const { data: createdId, error } = await supabase.rpc(
          "create_scheduled_exam",
          {
            exam_title: exam.title,
            target_subject_id: exam.subjectId,
            target_class_id: exam.classId,
            start_time: exam.startsAt,
            duration_in_minutes: exam.duration,
            question_ids: exam.questionIds,
            access_code_value: exam.accessCode || null,
            should_shuffle_questions: exam.shuffleQuestions,
            should_use_fullscreen: exam.fullscreenMode,
          },
        );
        if (error) throw error;
        exam = { ...exam, id: createdId };
      }
      setExams([exam, ...exams]);
      setCreate(false);
      notify("Ujian berhasil dijadwalkan");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Ujian gagal disimpan", true);
    }
  };
  return (
    <div className="portal-page">
      <PageTitle
        eyebrow="MANAJEMEN UJIAN"
        title="Daftar Ujian"
        description="Buat, jadwalkan, dan pantau seluruh ujian."
        action={
          <button className="primary" onClick={() => setCreate(true)}>
            <Plus />
            Buat ujian
          </button>
        }
      />
      <Toolbar
        placeholder="Cari judul, mata pelajaran, atau kelas…"
        value={query}
        onChange={setQuery}
        onExport={exportExams}
      />
      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>UJIAN</th>
              <th>KELAS</th>
              <th>JADWAL</th>
              <th>PESERTA</th>
              <th>STATUS</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filteredExams.map((exam) => (
              <tr key={exam.id}>
                <td>
                  <div className="exam-cell">
                    <span>{exam.subject.slice(0, 2).toUpperCase()}</span>
                    <p>
                      <b>{exam.title}</b>
                      <small>
                        {exam.subject} · {exam.questions} soal
                      </small>
                    </p>
                  </div>
                </td>
                <td>{exam.className}</td>
                <td>
                  <b className="table-main">{exam.date}</b>
                  <small>
                    {exam.time} · {exam.duration} menit
                  </small>
                </td>
                <td>
                  <div className="participant">
                    <div>
                      <i />
                      <i />
                      <i />
                    </div>
                    <span>{exam.participants} siswa</span>
                  </div>
                </td>
                <td>
                  <Status value={exam.status} />
                </td>
                <td>
                  <button
                    className="more"
                    title="Majukan status ujian"
                    aria-label={`Majukan status ${exam.title}`}
                    onClick={() => void advanceStatus(exam)}
                  >
                    <MoreHorizontal />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="table-footer">
          <span>
            Menampilkan {filteredExams.length} dari {exams.length} ujian
          </span>
          <div>
            <button disabled>
              <ArrowLeft />
            </button>
            <button className="active">1</button>
            <button>
              <ArrowRight />
            </button>
          </div>
        </div>
      </div>
      {create && <ExamModal close={() => setCreate(false)} save={addExam} />}
    </div>
  );
}

function Toolbar({
  placeholder,
  value,
  onChange,
  filterValue,
  onFilterChange,
  onExport,
}: {
  placeholder: string;
  value?: string;
  onChange?: (value: string) => void;
  filterValue?: string;
  onFilterChange?: (value: string) => void;
  onExport?: () => void;
}) {
  return (
    <div className="toolbar">
      <div>
        <Search />
        <input
          placeholder={placeholder}
          value={value}
          onChange={
            onChange ? (event) => onChange(event.target.value) : undefined
          }
        />
      </div>
      {value && onChange && (
        <button onClick={() => onChange("")}>
          <X />
          Bersihkan
        </button>
      )}
      {onFilterChange && (
        <label className="toolbar-filter">
          <Filter />
          <select value={filterValue} onChange={(event) => onFilterChange(event.target.value)}>
            <option value="all">Semua status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>
        </label>
      )}
      {onExport && (
        <button type="button" onClick={onExport}>
          <Download />
          Ekspor CSV
        </button>
      )}
    </div>
  );
}

function ExamModal({
  close,
  save,
}: {
  close: () => void;
  save: (exam: ExamDraft) => void;
}) {
  type Option = { id: string; name: string };
  type AssignmentOption = { subjectId: string; classId: string; className: string };
  type QuestionOption = { id: string; body: string; type: string };
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [subjects, setSubjects] = useState<Option[]>([]);
  const [classes, setClasses] = useState<Option[]>([]);
  const [assignments, setAssignments] = useState<AssignmentOption[]>([]);
  const [availableQuestions, setAvailableQuestions] = useState<QuestionOption[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [classId, setClassId] = useState("");
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [duration, setDuration] = useState(90);
  const [startsAt, setStartsAt] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [fullscreenMode, setFullscreenMode] = useState(true);
  useEffect(() => {
    if (!supabase) {
      return;
    }
    void supabase
      .from("teacher_subjects")
      .select("subject_id,class_id,subjects(name),classes(name)")
      .then(({ data }) => {
      const assignments = data ?? [];
      const nextSubjects = Array.from(new Map(assignments.map((item) => [
        item.subject_id,
        { id: item.subject_id, name: relationName(item.subjects) },
      ])).values());
      const nextClasses = Array.from(new Map(assignments.map((item) => [
        item.class_id,
        { id: item.class_id, name: relationName(item.classes) },
      ])).values());
      setAssignments(assignments.map((item) => ({
        subjectId: item.subject_id,
        classId: item.class_id,
        className: relationName(item.classes),
      })));
      setSubjects(nextSubjects);
      setClasses(nextClasses);
      setSubjectId((current) => current || nextSubjects[0]?.id || "");
      setClassId((current) => current || nextClasses[0]?.id || "");
      });
  }, []);
  useEffect(() => {
    if (!subjectId || assignments.length === 0) return;
    const matchingClasses = Array.from(new Map(
      assignments
        .filter((item) => item.subjectId === subjectId)
        .map((item) => [item.classId, { id: item.classId, name: item.className }]),
    ).values());
    setClasses(matchingClasses);
    setClassId((current) => matchingClasses.some((item) => item.id === current)
      ? current
      : matchingClasses[0]?.id ?? "");
  }, [assignments, subjectId]);
  useEffect(() => {
    if (!supabase || !subjectId) return;
    void supabase
      .from("questions")
      .select("id,body,type,question_banks!inner(subject_id)")
      .eq("question_banks.subject_id", subjectId)
      .eq("archived", false)
      .order("created_at")
      .then(({ data }) => setAvailableQuestions((data ?? []).map((item) => ({ id: item.id, body: item.body, type: item.type }))));
    setSelectedQuestions([]);
  }, [subjectId]);
  const subject = subjects.find((item) => item.id === subjectId)?.name ?? "—";
  const className = classes.find((item) => item.id === classId)?.name ?? "—";
  const finish = () =>
    save({
      id: crypto.randomUUID(),
      title,
      subject,
      className,
      date: startsAt ? new Date(startsAt).toLocaleDateString("id-ID") : "Belum dijadwalkan",
      time: startsAt ? new Date(startsAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "—",
      duration,
      questions: selectedQuestions.length,
      status: startsAt ? "terjadwal" : "draft",
      participants: 0,
      subjectId,
      classId,
      startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
      accessCode,
      shuffleQuestions,
      fullscreenMode,
      questionIds: selectedQuestions,
    });
  return (
    <Modal close={close} wide>
      <div className="wizard">
        <header>
          <div>
            <p>BUAT UJIAN BARU</p>
            <h2>
              {
                [
                  "Informasi Dasar",
                  "Pilih Soal",
                  "Waktu & Keamanan",
                  "Review Ujian",
                ][step - 1]
              }
            </h2>
          </div>
          <button onClick={close}>
            <X />
          </button>
        </header>
        <div className="stepper">
          {[1, 2, 3, 4].map((s) => (
            <span className={step >= s ? "active" : ""} key={s}>
              <i>{step > s ? <Check /> : s}</i>
              <b>{["Info Dasar", "Soal", "Pengaturan", "Review"][s - 1]}</b>
            </span>
          ))}
        </div>
        <div className="wizard-body">
          {step === 1 && (
            <>
              <FormField label="Judul ujian">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Penilaian Akhir Semester"
                />
              </FormField>
              <div className="form-grid">
                <FormField label="Mata pelajaran">
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                  >
                    {subjects.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
                  </select>
                </FormField>
                <FormField label="Target kelas">
                  <select
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                  >
                    {classes.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
                  </select>
                </FormField>
              </div>
            </>
          )}
          {step === 2 && (
            <div className="wizard-question-list">
              <p>{selectedQuestions.length} dari {availableQuestions.length} soal dipilih</p>
              {availableQuestions.length === 0 && <div className="choice-card"><FileQuestion /><div><b>Belum ada soal</b><p>Tambahkan soal pada bank soal untuk mata pelajaran ini.</p></div></div>}
              {availableQuestions.map((item) => (
                <label className="choice-card" key={item.id}>
                  <input
                    type="checkbox"
                    checked={selectedQuestions.includes(item.id)}
                    onChange={(event) => setSelectedQuestions((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))}
                  />
                  <div><b>{item.body}</b><p>{item.type === "essay" ? "Essay" : "Pilihan ganda"}</p></div>
                </label>
              ))}
            </div>
          )}
          {step === 3 && (
            <>
              <div className="form-grid">
                <FormField label="Durasi (menit)">
                  <input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                  />
                </FormField>
                <FormField label="Mulai ujian">
                  <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
                </FormField>
                <FormField label="Kode akses (opsional)">
                  <input value={accessCode} onChange={(e) => setAccessCode(e.target.value.toUpperCase())} placeholder="Contoh: MATH26" />
                </FormField>
              </div>
              <div className="switch-list">
                <label>
                  <span>
                    <b>Acak urutan soal</b>
                    <small>Urutan berbeda untuk setiap siswa</small>
                  </span>
                  <input type="checkbox" checked={shuffleQuestions} onChange={(e) => setShuffleQuestions(e.target.checked)} />
                </label>
                <label>
                  <span>
                    <b>Mode layar penuh</b>
                    <small>Catat saat siswa keluar dari ujian</small>
                  </span>
                  <input type="checkbox" checked={fullscreenMode} onChange={(e) => setFullscreenMode(e.target.checked)} />
                </label>
              </div>
            </>
          )}
          {step === 4 && (
            <div className="review-box">
              <CheckCircle2 />
              <h3>Ujian siap disimpan sebagai draft</h3>
              <p>
                <b>{title || "Tanpa judul"}</b> · {subject} · Kelas {className}
              </p>
              <span>
                {duration} menit · {selectedQuestions.length} soal · {startsAt ? new Date(startsAt).toLocaleString("id-ID") : "Belum dijadwalkan"}
              </span>
            </div>
          )}
        </div>
        <footer>
          <button onClick={close}>Batal</button>
          <div>
            {step > 1 && (
              <button onClick={() => setStep(step - 1)}>Kembali</button>
            )}
            <button
              className="primary"
              disabled={(step === 1 && (!title.trim() || !subjectId || !classId)) || (step === 2 && selectedQuestions.length === 0) || (step === 3 && (!startsAt || duration < 1))}
              onClick={() => (step < 4 ? setStep(step + 1) : finish())}
            >
              {step < 4 ? "Lanjut" : "Jadwalkan ujian"}
              <ArrowRight />
            </button>
          </div>
        </footer>
      </div>
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

function PasswordInput(props: Omit<ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-control">
      <input {...props} type={visible ? "text" : "password"} />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
        title={visible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
      >
        {visible ? <EyeOff /> : <Eye />}
      </button>
    </div>
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
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

type ManagedUser = Profile & {
  created_at: string;
  class_id: string | null;
  class_name: string | null;
};
type ClassOption = { id: string; name: string };

function UserManagement({
  notify,
  roleFilter,
  title,
  description,
  canManage,
}: {
  notify: (text: string, error?: boolean) => void;
  roleFilter: Role;
  title: string;
  description: string;
  canManage: boolean;
}) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [create, setCreate] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [resetting, setResetting] = useState<ManagedUser | null>(null);
  const [query, setQuery] = useState("");
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classFilter, setClassFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const loadUsers = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const profileQuery = supabase
      .from("profiles")
      .select(
        "id,full_name,email,role,student_number,active,created_at,class_students(class_id,classes(name))",
      )
      .eq("role", roleFilter)
      .order("created_at", { ascending: false });
    const classQuery =
      roleFilter === "siswa"
        ? supabase.from("classes").select("id,name").order("name")
        : Promise.resolve({ data: [] as ClassOption[], error: null });
    const [profileResult, classResult] = await Promise.all([
      profileQuery,
      classQuery,
    ]);
    if (profileResult.error) notify(profileResult.error.message, true);
    else {
      const normalized = (profileResult.data ?? []).map((row) => {
        const membership = Array.isArray(row.class_students)
          ? row.class_students[0]
          : undefined;
        const relatedClass = membership?.classes as unknown;
        const resolvedClassName = relationName(relatedClass);
        const className = resolvedClassName === "—" ? null : resolvedClassName;
        return {
          ...row,
          class_id: membership?.class_id ?? null,
          class_name: className ?? null,
        } as ManagedUser;
      });
      setUsers(normalized);
    }
    if (classResult.error) notify(classResult.error.message, true);
    else setClasses((classResult.data ?? []) as ClassOption[]);
    setLoading(false);
  }, [notify, roleFilter]);
  useEffect(() => {
    loadUsers();
  }, [loadUsers]);
  const invoke = async (body: Record<string, unknown>) => {
    if (!supabase) throw new Error("Supabase belum dikonfigurasi.");
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body,
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };
  const createUser = async (form: {
    full_name: string;
    email: string;
    password: string;
    role: Role;
    student_number: string;
    class_id: string;
  }) => {
    try {
      await invoke({
        action: "create",
        ...form,
        role: roleFilter,
        student_number: form.student_number || null,
        class_id: form.class_id || null,
      });
      setCreate(false);
      notify("Akun pengguna berhasil dibuat.");
      await loadUsers();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Gagal membuat akun.",
        true,
      );
    }
  };
  const toggleUser = async (user: ManagedUser) => {
    try {
      await invoke({
        action: "set_active",
        user_id: user.id,
        active: !user.active,
      });
      notify(user.active ? "Akun dinonaktifkan." : "Akun diaktifkan.");
      await loadUsers();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Gagal memperbarui akun.",
        true,
      );
    }
  };
  const resetUser = async (user: ManagedUser, password: string) => {
    try {
      await invoke({ action: "reset_password", user_id: user.id, password });
      setResetting(null);
      notify("Kata sandi sementara berhasil diperbarui.");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Gagal mereset kata sandi.",
        true,
      );
    }
  };
  const updateUser = async (form: {
    id: string;
    full_name: string;
    email: string;
    role: Role;
    student_number: string;
    class_id: string;
  }) => {
    try {
      await invoke({
        action: "update",
        user_id: form.id,
        full_name: form.full_name,
        email: form.email,
        role: roleFilter,
        student_number: form.student_number || null,
        class_id: form.class_id || null,
      });
      setEditing(null);
      notify("Data pengguna berhasil diperbarui.");
      await loadUsers();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Gagal memperbarui pengguna.",
        true,
      );
    }
  };
  const deleteUser = async (user: ManagedUser) => {
    if (
      !window.confirm(
        `Hapus akun ${user.full_name}? Tindakan ini tidak dapat dibatalkan.`,
      )
    )
      return;
    try {
      await invoke({ action: "delete", user_id: user.id });
      notify("Akun pengguna berhasil dihapus.");
      await loadUsers();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Gagal menghapus pengguna.",
        true,
      );
    }
  };
  const createClass = async () => {
    if (!supabase) return;
    const name = window.prompt("Nama kelas baru (contoh: IX A):")?.trim();
    if (!name) return;
    const { data: activeYear, error: yearError } = await supabase
      .from("academic_years")
      .select("id")
      .eq("active", true)
      .maybeSingle();
    if (yearError) return notify(yearError.message, true);
    const { error } = await supabase.from("classes").insert({
      name,
      academic_year_id: activeYear?.id ?? null,
    });
    if (error) notify(error.message, true);
    else {
      notify("Kelas berhasil ditambahkan.");
      await loadUsers();
    }
  };
  const deleteClass = async () => {
    if (!supabase || !classFilter) {
      notify("Pilih kelas yang ingin dihapus terlebih dahulu.", true);
      return;
    }
    const selectedClass = classes.find((item) => item.id === classFilter);
    if (!selectedClass) return;
    const memberCount = users.filter((user) => user.class_id === classFilter).length;
    if (!window.confirm(`Hapus kelas ${selectedClass.name}? ${memberCount} siswa akan dilepas dari kelas ini.`)) return;
    const { error } = await supabase.from("classes").delete().eq("id", classFilter);
    if (error) notify(`Kelas belum dapat dihapus: ${error.message}`, true);
    else {
      setClassFilter("");
      notify("Kelas berhasil dihapus.");
      await loadUsers();
    }
  };
  const normalizedQuery = query.trim().toLowerCase();
  const filteredUsers = users.filter(
    (user) =>
      (!classFilter || user.class_id === classFilter) &&
      (activeFilter === "all" || (activeFilter === "active" ? user.active : !user.active)) &&
      [
        user.full_name,
        user.email,
        user.student_number ?? "",
        user.class_name ?? "",
        user.role,
      ].some((value) => value.toLowerCase().includes(normalizedQuery)),
  );
  const exportUsers = () => {
    const headers = roleFilter === "siswa"
      ? ["Nama", "Email", "Kelas", "NIS", "Status", "Dibuat"]
      : ["Nama", "Email", "Peran", "Status", "Dibuat"];
    const rows = filteredUsers.map((user) => roleFilter === "siswa"
      ? [user.full_name, user.email, user.class_name ?? "Belum ditempatkan", user.student_number ?? "", user.active ? "Aktif" : "Nonaktif", new Date(user.created_at).toLocaleDateString("id-ID")]
      : [user.full_name, user.email, capitalize(user.role), user.active ? "Aktif" : "Nonaktif", new Date(user.created_at).toLocaleDateString("id-ID")]);
    const csv = [headers, ...rows].map((columns) => columns.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${roleFilter}-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="portal-page">
      <PageTitle
        eyebrow="ADMINISTRASI AKUN"
        title={title}
        description={description}
        action={
          canManage ? (
            <div className="title-actions">
              {roleFilter === "siswa" && (
                <>
                  <button onClick={() => void deleteClass()} disabled={!classFilter}>
                    <Trash2 /> Hapus kelas
                  </button>
                  <button onClick={() => void createClass()}>
                    <Plus /> Tambah kelas
                  </button>
                </>
              )}
              <button className="primary" onClick={() => setCreate(true)}>
                <UserPlus />
                Tambah {roleFilter}
              </button>
            </div>
          ) : undefined
        }
      />
      {roleFilter === "siswa" && (
        <div className="class-tabs">
          <button
            className={classFilter === "" ? "active" : ""}
            onClick={() => setClassFilter("")}
          >
            Semua siswa <span>{users.length}</span>
          </button>
          {classes.map((item) => (
            <button
              className={classFilter === item.id ? "active" : ""}
              onClick={() => setClassFilter(item.id)}
              key={item.id}
            >
              {item.name}{" "}
              <span>
                {users.filter((user) => user.class_id === item.id).length}
              </span>
            </button>
          ))}
        </div>
      )}
      <Toolbar
        placeholder={roleFilter === "siswa" ? "Cari nama, email, atau NIS…" : "Cari nama atau email…"}
        value={query}
        onChange={setQuery}
        filterValue={activeFilter}
        onFilterChange={setActiveFilter}
        onExport={exportUsers}
      />
      <div className="table-card users-table">
        <table>
          <thead>
            <tr>
              <th>PENGGUNA</th>
              <th>{roleFilter === "siswa" ? "KELAS" : "PERAN"}</th>
              {roleFilter === "siswa" && <th>NIS</th>}
              <th>STATUS</th>
              <th>DIBUAT</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={roleFilter === "siswa" ? 6 : 5}>Memuat pengguna…</td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={roleFilter === "siswa" ? 6 : 5}>Belum ada pengguna yang cocok.</td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className="student-cell">
                      <span>{getInitials(user.full_name)}</span>
                      <p>
                        <b>{user.full_name}</b>
                        <small>{user.email}</small>
                      </p>
                    </div>
                  </td>
                  <td>
                    {roleFilter === "siswa" ? (
                      user.class_name || "Belum ditempatkan"
                    ) : (
                      <span className={`role-badge ${user.role}`}>
                        {capitalize(user.role)}
                      </span>
                    )}
                  </td>
                  {roleFilter === "siswa" && <td>{user.student_number || "—"}</td>}
                  <td>
                    <span
                      className={`user-status ${user.active ? "active" : ""}`}
                    >
                      <i />
                      {user.active ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td>
                    {new Date(user.created_at).toLocaleDateString("id-ID")}
                  </td>
                  <td>
                    {canManage && (
                      <div className="user-actions">
                        <button
                          onClick={() => setEditing(user)}
                          title="Edit pengguna"
                        >
                          <Pencil />
                        </button>
                        <button
                          onClick={() => setResetting(user)}
                          title="Reset kata sandi"
                        >
                          <LockKeyhole />
                        </button>
                        <button onClick={() => toggleUser(user)}>
                          {user.active ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                        <button
                          className="danger"
                          onClick={() => deleteUser(user)}
                          title="Hapus pengguna"
                        >
                          <Trash2 />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {create && (
        <CreateUserModal
          close={() => setCreate(false)}
          save={createUser}
          lockedRole={roleFilter}
          classes={classes}
        />
      )}
      {editing && (
        <EditUserModal
          user={editing}
          close={() => setEditing(null)}
          save={updateUser}
          lockedRole={roleFilter}
          classes={classes}
        />
      )}
      {resetting && (
        <ResetUserPasswordModal
          user={resetting}
          close={() => setResetting(null)}
          save={(password) => resetUser(resetting, password)}
        />
      )}
    </div>
  );
}
function CreateUserModal({
  close,
  save,
  lockedRole,
  classes,
}: {
  close: () => void;
  save: (form: {
    full_name: string;
    email: string;
    password: string;
    role: Role;
    student_number: string;
    class_id: string;
  }) => void;
  lockedRole: Role;
  classes: ClassOption[];
}) {
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role: lockedRole,
    student_number: "",
    class_id: "",
  });
  return (
    <Modal close={close}>
      <form
        className="simple-modal"
        onSubmit={(event) => {
          event.preventDefault();
          save(form);
        }}
      >
        <header>
          <div>
            <p>AKUN BARU</p>
            <h2>Tambah pengguna</h2>
          </div>
          <button type="button" onClick={close}>
            <X />
          </button>
        </header>
        <div className="modal-content">
          <FormField label="Nama lengkap">
            <input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              required
            />
          </FormField>
          <FormField label="Email">
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </FormField>
          <div className={lockedRole === "siswa" ? "form-grid" : ""}>
            <FormField label="Peran">
              <select
                value={form.role}
                disabled
                onChange={(e) =>
                  setForm({ ...form, role: e.target.value as Role })
                }
              >
                <option value="siswa">Siswa</option>
                <option value="guru">Guru</option>
                <option value="admin">Admin</option>
              </select>
            </FormField>
            {lockedRole === "siswa" && (
              <FormField label="NIS">
                <input value={form.student_number} onChange={(e) => setForm({ ...form, student_number: e.target.value })} />
              </FormField>
            )}
          </div>
          {lockedRole === "siswa" && (
            <FormField label="Kelas">
              <select
                value={form.class_id}
                onChange={(event) =>
                  setForm({ ...form, class_id: event.target.value })
                }
              >
                <option value="">Belum ditempatkan</option>
                {classes.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </FormField>
          )}
          <FormField label="Kata sandi sementara">
            <PasswordInput
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Minimal 8 karakter"
              required
            />
          </FormField>
          <p className="form-hint">
            Pengguna dapat mengganti kata sandi melalui fitur lupa kata sandi.
          </p>
        </div>
        <footer>
          <button type="button" onClick={close}>
            Batal
          </button>
          <button className="primary">Buat Akun</button>
        </footer>
      </form>
    </Modal>
  );
}

function EditUserModal({
  user,
  close,
  save,
  lockedRole,
  classes,
}: {
  user: ManagedUser;
  close: () => void;
  save: (form: {
    id: string;
    full_name: string;
    email: string;
    role: Role;
    student_number: string;
    class_id: string;
  }) => void;
  lockedRole: Role;
  classes: ClassOption[];
}) {
  const [form, setForm] = useState({
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    role: lockedRole,
    student_number: user.student_number ?? "",
    class_id: user.class_id ?? "",
  });
  return (
    <Modal close={close}>
      <form
        className="simple-modal"
        onSubmit={(event) => {
          event.preventDefault();
          save(form);
        }}
      >
        <header>
          <div>
            <p>EDIT AKUN</p>
            <h2>Ubah data pengguna</h2>
          </div>
          <button type="button" onClick={close}>
            <X />
          </button>
        </header>
        <div className="modal-content">
          <FormField label="Nama lengkap">
            <input
              value={form.full_name}
              onChange={(event) =>
                setForm({ ...form, full_name: event.target.value })
              }
              required
            />
          </FormField>
          <FormField label="Email">
            <input
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm({ ...form, email: event.target.value })
              }
              required
            />
          </FormField>
          <div className={lockedRole === "siswa" ? "form-grid" : ""}>
            <FormField label="Peran">
              <select
                value={form.role}
                disabled
                onChange={(event) =>
                  setForm({ ...form, role: event.target.value as Role })
                }
              >
                <option value="siswa">Siswa</option>
                <option value="guru">Guru</option>
                <option value="admin">Admin</option>
              </select>
            </FormField>
            {lockedRole === "siswa" && (
              <FormField label="NIS">
                <input value={form.student_number} onChange={(event) => setForm({ ...form, student_number: event.target.value })} />
              </FormField>
            )}
          </div>
          {lockedRole === "siswa" && (
            <FormField label="Kelas">
              <select
                value={form.class_id}
                onChange={(event) =>
                  setForm({ ...form, class_id: event.target.value })
                }
              >
                <option value="">Belum ditempatkan</option>
                {classes.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </FormField>
          )}
          <p className="form-hint">
            Perubahan role langsung memengaruhi halaman dan data yang dapat
            diakses pengguna.
          </p>
        </div>
        <footer>
          <button type="button" onClick={close}>
            Batal
          </button>
          <button className="primary">Simpan Perubahan</button>
        </footer>
      </form>
    </Modal>
  );
}

function ResetUserPasswordModal({
  user,
  close,
  save,
}: {
  user: ManagedUser;
  close: () => void;
  save: (password: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 8) return;
    if (password !== confirmation) return;
    save(password);
  };
  const mismatch = confirmation.length > 0 && password !== confirmation;
  return (
    <Modal close={close}>
      <form className="simple-modal" onSubmit={submit}>
        <header>
          <div>
            <p>KEAMANAN AKUN</p>
            <h2>Reset kata sandi</h2>
          </div>
          <button type="button" onClick={close}>
            <X />
          </button>
        </header>
        <div className="modal-content">
          <p className="auth-security-note">
            Atur kata sandi sementara baru untuk <b>{user.full_name}</b>.
          </p>
          <FormField label="Kata sandi sementara">
            <PasswordInput
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              autoComplete="new-password"
              required
            />
          </FormField>
          <FormField label="Konfirmasi kata sandi">
            <PasswordInput
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              minLength={8}
              autoComplete="new-password"
              required
            />
          </FormField>
          {mismatch && (
            <p className="form-error">Konfirmasi kata sandi tidak sesuai.</p>
          )}
        </div>
        <footer>
          <button type="button" onClick={close}>
            Batal
          </button>
          <button
            className="primary"
            disabled={password.length < 8 || mismatch}
          >
            Simpan Kata Sandi
          </button>
        </footer>
      </form>
    </Modal>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function Grading({ notify }: { notify: (text: string) => void }) {
  type GradingItem = { id: string; name: string; answer: string; question: string; key: string; weight: number };
  const [selected, setSelected] = useState(0);
  const [items, setItems] = useState<GradingItem[]>([]);
  const [gradingLoading, setGradingLoading] = useState(true);
  const [scores, setScores] = useState<Record<number, string>>({});
  const [comments, setComments] = useState<Record<number, string>>({});
  const [showRubric, setShowRubric] = useState(false);
  useEffect(() => {
    if (!supabase) {
      setGradingLoading(false);
      return;
    }
    void supabase
      .from("answers")
      .select("id,essay_text,score,teacher_comment,questions!inner(body,answer_key,weight,type),attempts!inner(status,profiles!attempts_student_id_fkey(full_name))")
      .eq("questions.type", "essay")
      .in("attempts.status", ["submitted", "grading"])
      .order("answered_at")
      .then(({ data }) => {
        const loaded = (data ?? []).map((row) => {
          const question = Array.isArray(row.questions) ? row.questions[0] : row.questions;
          const attempt = Array.isArray(row.attempts) ? row.attempts[0] : row.attempts;
          return {
            id: row.id,
            name: relationName(attempt?.profiles),
            answer: row.essay_text ?? "(Tidak ada jawaban)",
            question: question?.body ?? "—",
            key: question?.answer_key ?? "Belum ada kunci jawaban.",
            weight: Number(question?.weight ?? 1),
          };
        });
        setItems(loaded);
        setScores(Object.fromEntries((data ?? []).map((row, index) => [index, row.score === null ? "" : String(row.score)])));
        setComments(Object.fromEntries((data ?? []).map((row, index) => [index, row.teacher_comment ?? ""])));
        setGradingLoading(false);
      });
  }, []);
  if (gradingLoading) {
    return <div className="portal-page"><div className="card dashboard-empty">Memuat jawaban essay…</div></div>;
  }
  const currentItem = items[selected];
  if (!currentItem) {
    return <div className="portal-page"><PageTitle eyebrow="PENILAIAN" title="Koreksi Essay" description="Penilaian per soal membantu menjaga konsistensi skor." /><div className="card dashboard-empty">Tidak ada jawaban essay yang menunggu koreksi.</div></div>;
  }
  return (
    <div className="portal-page">
      <PageTitle
        eyebrow="PENILAIAN"
        title="Koreksi Essay"
        description="Penilaian per soal membantu menjaga konsistensi skor."
      />
      <div className="grading-shell">
        <aside>
          <div className="grading-progress">
            <p>
              <b>Jawaban {selected + 1} dari {items.length}</b>
              <span>{Object.values(scores).filter(Boolean).length} / {items.length} dinilai</span>
            </p>
            <i>
              <span style={{ width: `${(Object.values(scores).filter(Boolean).length / items.length) * 100}%` }} />
            </i>
          </div>
          <div className="student-answer-list">
            {items.map((item, i) => (
              <button
                onClick={() => setSelected(i)}
                className={selected === i ? "active" : ""}
                key={item.id}
              >
                <span>
                  {item.name
                    .split(" ")
                    .map((x) => x[0])
                    .join("")}
                </span>
                <p>
                    <b>{item.name}</b>
                  <small>
                    {scores[i] ? `Skor ${scores[i]}/${item.weight}` : "Belum dinilai"}
                  </small>
                </p>
                {scores[i] ? <CheckCircle2 /> : <ChevronRight />}
              </button>
            ))}
          </div>
        </aside>
        <main className="grading-main">
          <div className="question-reference">
            <small>SOAL ESSAY · BOBOT {currentItem.weight} POIN</small>
            <h3>
              {currentItem.question}
            </h3>
            <button onClick={() => setShowRubric((value) => !value)}>
              <BookOpen />
              {showRubric ? "Tutup rubrik" : "Lihat rubrik & kunci jawaban"}
            </button>
            {showRubric && (
              <div className="rubric-box">
                <b>Pedoman penilaian</b>
                <p>{currentItem.key}</p>
              </div>
            )}
          </div>
          <div className="answer-paper">
            <div>
              <span className="avatar sm">
                {currentItem.name
                  .split(" ")
                  .map((x) => x[0])
                  .join("")}
              </span>
              <p>
                <b>{currentItem.name}</b>
                <small>Jawaban tersimpan pada sistem</small>
              </p>
            </div>
            <p>{currentItem.answer}</p>
          </div>
          <div className="score-panel">
            <FormField label={`Skor (maks. ${currentItem.weight})`}>
              <input
                type="number"
                min="0"
                max={currentItem.weight}
                value={scores[selected] ?? ""}
                onChange={(e) =>
                  setScores({ ...scores, [selected]: e.target.value })
                }
                placeholder="0"
              />
            </FormField>
            <FormField label="Komentar untuk siswa (opsional)">
              <input
                value={comments[selected] ?? ""}
                onChange={(event) =>
                  setComments({ ...comments, [selected]: event.target.value })
                }
                placeholder="Berikan umpan balik singkat…"
              />
            </FormField>
            <button
              className="primary"
              onClick={async () => {
                const score = Number(scores[selected]);
                if (scores[selected] === "" || score < 0 || score > currentItem.weight) {
                  notify(`Masukkan skor antara 0 sampai ${currentItem.weight}`);
                  return;
                }
                if (supabase) {
                  const { error } = await supabase.rpc("grade_essay_answer", {
                    target_answer_id: currentItem.id,
                    awarded_score: score,
                    feedback: comments[selected] || null,
                  });
                  if (error) {
                    notify(error.message);
                    return;
                  }
                }
                notify("Nilai berhasil disimpan");
                if (selected < items.length - 1) setSelected(selected + 1);
              }}
            >
              Simpan & lanjut
              <ArrowRight />
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function Reports() {
  type ReportRow = { name: string; className: string; exam: string; score: number; status: string };
  const [rows, setRows] = useState<ReportRow[]>([]);
  useEffect(() => {
    if (!supabase) return;
    void supabase
      .from("attempts")
      .select("final_score,status,profiles!attempts_student_id_fkey(full_name),exams!inner(title,classes(name))")
      .in("status", ["submitted", "grading", "final"])
      .order("submitted_at", { ascending: false })
      .then(({ data }) => setRows((data ?? []).map((item) => {
        const exam = Array.isArray(item.exams) ? item.exams[0] : item.exams;
        return {
          name: relationName(item.profiles),
          className: relationName(exam?.classes),
          exam: String(exam?.title ?? "—"),
          score: Number(item.final_score ?? 0),
          status: Number(item.final_score ?? 0) >= 75 ? "Lulus" : "Perlu pendampingan",
        };
      })));
  }, []);
  const grades = rows.map((item) => item.score);
  const average = grades.length ? grades.reduce((total, value) => total + value, 0) / grades.length : 0;
  const highest = grades.length ? Math.max(...grades) : 0;
  const lowest = grades.length ? Math.min(...grades) : 0;
  const passed = rows.filter((item) => item.score >= 75).length;
  const exportReport = () =>
    downloadCsv(
      "laporan-hasil-ujian.csv",
      ["Nama", "Kelas", "Ujian", "Nilai", "Status"],
      rows.map((item) => [item.name, item.className, item.exam, item.score, item.status]),
    );
  return (
    <div className="portal-page">
      <PageTitle
        eyebrow="LAPORAN & ANALITIK"
        title="Hasil Ujian"
        description="Analisis capaian kelas dan kualitas soal."
        action={
          <button className="outline" onClick={exportReport}>
            <Download />
            Ekspor laporan
          </button>
        }
      />
      <div className="report-stats">
        <div>
          <small>RATA-RATA</small>
          <b>{average.toLocaleString("id-ID", { maximumFractionDigits: 1 })}</b>
          <span>{rows.length} hasil</span>
        </div>
        <div>
          <small>NILAI TERTINGGI</small>
          <b>{highest}</b>
          <span>{rows.find((item) => item.score === highest)?.name ?? "—"}</span>
        </div>
        <div>
          <small>NILAI TERENDAH</small>
          <b>{lowest}</b>
          <span>Perlu pendampingan</span>
        </div>
        <div>
          <small>KETUNTASAN</small>
          <b>{rows.length ? Math.round((passed / rows.length) * 100) : 0}%</b>
          <span>{passed} dari {rows.length} siswa</span>
        </div>
      </div>
      <div className="report-grid">
        <section className="card chart-card">
          <CardHead title="Distribusi nilai" />
          <div className="grade-chart">
            {grades.map((v, i) => (
              <div key={i}>
                <i style={{ height: `${Math.max(v, 4)}%` }} />
                <span>{i + 1}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="card">
          <CardHead title="Ringkasan pengerjaan" />
          <div className="donut-wrap">
            <div className="donut">
              <strong>{rows.length}</strong>
              <span>peserta</span>
            </div>
            <ul>
              <li>
                <i className="green" />
                Lulus KKM <b>{passed}</b>
              </li>
              <li>
                <i className="amber" />
                Di bawah KKM <b>{rows.length - passed}</b>
              </li>
              <li>
                <i className="gray" />
                Tidak hadir <b>0</b>
              </li>
            </ul>
          </div>
        </section>
      </div>
      <section className="card item-analysis">
        <CardHead title="Data hasil siswa" />
        {rows.length === 0 ? (
          <div className="dashboard-empty">Belum ada hasil ujian yang dapat dianalisis.</div>
        ) : rows.slice(0, 8).map((item, index) => (
          <div className="analysis-row" key={`${item.name}-${item.exam}-${index}`}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <p><b>{item.name}</b><small>{item.exam} · {item.className}</small></p>
            <div><small>NILAI AKHIR</small><b>{item.score}</b></div>
            <span className={`difficulty ${item.score >= 75 ? "mudah" : "sedang"}`}>
              {item.status}
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}

// Legacy settings implementation retained temporarily for migration reference.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function SettingsPage({
  profile,
  notify,
}: {
  profile: Profile;
  notify: (text: string, error?: boolean) => void;
}) {
  const [tab, setTab] = useState("profile");
  const [settings, setSettings] = useState(() =>
    loadLocal("school-settings", {
      schoolName: "SMP Negeri Harapan Bangsa",
      npsn: "20123456",
      address: "Jl. Pendidikan No. 17, Jakarta",
      academicYear: "2026/2027",
      examReminder: true,
      gradingReminder: true,
      securityAlert: true,
    }),
  );
  const [savingSettings, setSavingSettings] = useState(false);
  useEffect(() => {
    if (!supabase || profile.role !== "admin") return;
    void supabase
      .from("school_settings")
      .select("school_name,npsn,address,academic_year,exam_reminder,grading_reminder,security_alert")
      .eq("id", true)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setSettings({
          schoolName: data.school_name,
          npsn: data.npsn,
          address: data.address,
          academicYear: data.academic_year,
          examReminder: data.exam_reminder,
          gradingReminder: data.grading_reminder,
          securityAlert: data.security_alert,
        });
      });
  }, [profile.role]);
  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      if (supabase) {
        const { error } = await supabase.from("school_settings").upsert({
          id: true,
          school_name: settings.schoolName,
          npsn: settings.npsn,
          address: settings.address,
          academic_year: settings.academicYear,
          exam_reminder: settings.examReminder,
          grading_reminder: settings.gradingReminder,
          security_alert: settings.securityAlert,
          updated_at: new Date().toISOString(),
          updated_by: profile.id,
        });
        if (error) throw error;
      }
      saveLocal("school-settings", settings);
      notify("Pengaturan berhasil disimpan");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Pengaturan gagal disimpan", true);
    } finally {
      setSavingSettings(false);
    }
  };
  if (profile.role === "guru") {
    return (
      <div className="portal-page">
        <PageTitle
          eyebrow="AKUN SAYA"
          title="Profil Guru"
          description="Informasi akun pengajar yang terhubung ke sekolah."
        />
        <div className="card settings-form">
          <h2>Informasi akun</h2>
          <p>Hubungi Admin jika nama atau email perlu diperbarui.</p>
          <div className="form-grid">
            <FormField label="Nama lengkap">
              <input value={profile.full_name} readOnly />
            </FormField>
            <FormField label="Email">
              <input value={profile.email} readOnly />
            </FormField>
          </div>
          <div className="settings-save">
            <span>Hak akses: Guru · Konten dan penilaian akademik</span>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="portal-page">
      <PageTitle
        eyebrow="KONFIGURASI"
        title="Pengaturan"
        description="Kelola profil dan preferensi aplikasi."
      />
      <div className="settings-grid">
        <aside>
          <button
            className={tab === "profile" ? "active" : ""}
            onClick={() => setTab("profile")}
          >
            Profil sekolah
          </button>
          <button
            className={tab === "security" ? "active" : ""}
            onClick={() => setTab("security")}
          >
            Keamanan
          </button>
          <button
            className={tab === "academic" ? "active" : ""}
            onClick={() => setTab("academic")}
          >
            Tahun ajaran
          </button>
          <button
            className={tab === "notifications" ? "active" : ""}
            onClick={() => setTab("notifications")}
          >
            Notifikasi
          </button>
        </aside>
        <div className="card settings-form">
          {tab === "profile" && (
            <>
              <h2>Profil sekolah</h2>
              <p>Informasi ini digunakan pada laporan dan halaman siswa.</p>
              <div className="school-logo">
                <span>
                  <GraduationCap />
                </span>
              </div>
              <div className="form-grid">
                <FormField label="Nama sekolah">
                  <input
                    value={settings.schoolName}
                    onChange={(e) =>
                      setSettings({ ...settings, schoolName: e.target.value })
                    }
                  />
                </FormField>
                <FormField label="NPSN">
                  <input
                    value={settings.npsn}
                    onChange={(e) =>
                      setSettings({ ...settings, npsn: e.target.value })
                    }
                  />
                </FormField>
              </div>
              <FormField label="Alamat">
                <textarea
                  rows={3}
                  value={settings.address}
                  onChange={(e) =>
                    setSettings({ ...settings, address: e.target.value })
                  }
                />
              </FormField>
            </>
          )}
          {tab === "security" && (
            <>
              <h2>Keamanan akun</h2>
              <p>Informasi akses administrator yang sedang aktif.</p>
              <div className="form-grid">
                <FormField label="Administrator">
                  <input value={profile.full_name} readOnly />
                </FormField>
                <FormField label="Email akun">
                  <input value={profile.email} readOnly />
                </FormField>
              </div>
              <div className="dashboard-error">
                <ShieldCheck /> Sesi dan hak akses dikelola oleh Supabase Auth.
                Jangan bagikan akun administrator.
              </div>
            </>
          )}
          {tab === "academic" && (
            <>
              <h2>Tahun ajaran aktif</h2>
              <p>
                Digunakan sebagai periode bawaan saat membuat ujian dan laporan.
              </p>
              <FormField label="Tahun ajaran">
                <input
                  value={settings.academicYear}
                  onChange={(e) =>
                    setSettings({ ...settings, academicYear: e.target.value })
                  }
                  placeholder="2026/2027"
                />
              </FormField>
            </>
          )}
          {tab === "notifications" && (
            <>
              <h2>Preferensi notifikasi</h2>
              <p>
                Pilih informasi penting yang ingin ditampilkan kepada
                administrator.
              </p>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={settings.examReminder}
                  onChange={(e) =>
                    setSettings({ ...settings, examReminder: e.target.checked })
                  }
                />{" "}
                Pengingat ujian yang akan dimulai
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={settings.gradingReminder}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      gradingReminder: e.target.checked,
                    })
                  }
                />{" "}
                Pengingat jawaban yang belum dikoreksi
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={settings.securityAlert}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      securityAlert: e.target.checked,
                    })
                  }
                />{" "}
                Peringatan aktivitas keamanan
              </label>
            </>
          )}
          <div className="settings-save">
              <button className="primary" disabled={savingSettings} onClick={() => void saveSettings()}>
                {savingSettings ? "Menyimpan…" : "Simpan perubahan"}
            </button>
            <span>Anda masuk sebagai Admin.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExamRunner({
  notify,
}: {
  notify: (text: string, error?: boolean) => void;
}) {
  const { examId = "1" } = useParams();
  const navigate = useNavigate();
  type RunnerQuestion = {
    id: string;
    text: string;
    type: "multiple_choice" | "essay";
    options: string[];
    weight: number;
  };
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number | string>>(() =>
    loadLocal(`answers:${examId}`, {}),
  );
  const [marked, setMarked] = useState<string[]>(() =>
    loadLocal(`marked:${examId}`, []),
  );
  const [remaining, setRemaining] = useState(90 * 60);
  const [submit, setSubmit] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<RunnerQuestion[]>([]);
  const [examMeta, setExamMeta] = useState({
    title: "Penilaian Akhir Semester",
    subject: "Matematika",
    className: "Kelas IX",
    fullscreen: true,
    recordTabSwitches: true,
  });
  const [loadingExam, setLoadingExam] = useState(Boolean(supabase));
  const [examError, setExamError] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [submittedAccessCode, setSubmittedAccessCode] = useState("");
  const [startRequest, setStartRequest] = useState(0);
  const [needsAccessCode, setNeedsAccessCode] = useState(false);
  const essaySaveTimer = useRef<number | null>(null);
  const pendingEssay = useRef<{ questionId: string; value: string } | null>(null);
  const answerSaveQueue = useRef<Record<string, Promise<boolean>>>({});
  const finishingRef = useRef(false);
  const [pendingSaves, setPendingSaves] = useState(0);
  const [submittingExam, setSubmittingExam] = useState(false);
  const [studentId, setStudentId] = useState<string | null>(null);
  const question = questions[current];
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let active = true;
    const load = async () => {
      setLoadingExam(true);
      const [{ data: authData }, catalogResult] = await Promise.all([
        client.auth.getUser(),
        client.rpc("get_student_exam_catalog"),
      ]);
      const examRow = (catalogResult.data as StudentExamCatalogRow[] | null)?.find(
        (row) => row.exam_id === examId,
      );
      if (!active) return;
      if (!authData.user || catalogResult.error || !examRow) {
        setExamError(
          catalogResult.error?.message ??
            "Sesi siswa atau data ujian tidak ditemukan.",
        );
        setLoadingExam(false);
        return;
      }
      setStudentId(authData.user.id);
      const startResult = await client.rpc("start_exam_attempt", {
        requested_exam_id: examId,
        provided_access_code: submittedAccessCode.trim() || null,
      });
      if (!active) return;
      if (startResult.error) {
        const message = startResult.error.message;
        if (message.toLowerCase().includes("kode akses")) {
          setNeedsAccessCode(true);
          setExamError("");
        } else {
          setExamError(message);
        }
        setLoadingExam(false);
        return;
      }
      const startedAttempt = startResult.data?.[0];
      if (!startedAttempt) {
        setExamError("Server tidak dapat memulai attempt ujian.");
        setLoadingExam(false);
        return;
      }
      setAttemptId(startedAttempt.attempt_id);
      setNeedsAccessCode(false);
      const questionResult = await client.rpc("get_exam_questions", {
        requested_exam_id: examId,
      });
      if (questionResult.error) {
        setExamError(questionResult.error.message);
        setLoadingExam(false);
        return;
      }
      const loadedQuestions: RunnerQuestion[] = (questionResult.data ?? []).map((row: Record<string, unknown>) => ({
        id: String(row.question_id),
        text: String(row.body),
        type: row.kind === "essay" ? "essay" : "multiple_choice",
        options: Array.isArray(row.options) ? row.options.map(String) : [],
        weight: Number(row.weight ?? 1),
      }));
      const remoteAnswers = Object.fromEntries(
        (questionResult.data ?? [])
          .filter((row: Record<string, unknown>) =>
            row.essay_text !== null && row.essay_text !== undefined
            || row.selected_option !== null && row.selected_option !== undefined,
          )
          .map((row: Record<string, unknown>) => [
            String(row.question_id),
            row.essay_text ?? Number(row.selected_option),
          ]),
      ) as Record<string, number | string>;
      if (!loadedQuestions.length) {
        setExamError("Soal ujian belum tersedia atau waktu ujian sudah berakhir.");
        setLoadingExam(false);
        return;
      }
      setQuestions(loadedQuestions);
      setExamMeta({
        title: examRow.title,
        subject: examRow.subject_name ?? "Mata pelajaran",
        className: examRow.class_name ?? "Belum ada kelas",
        fullscreen: examRow.fullscreen_mode ?? true,
        recordTabSwitches: examRow.record_tab_switches ?? true,
      });
      setRemaining(Math.max(0, Math.floor((new Date(startedAttempt.deadline).getTime() - Date.now()) / 1000)));
      const localAnswers = loadLocal<Record<string, number | string>>(
        `answers:${examId}`,
        {},
      );
      setAnswers({ ...remoteAnswers, ...localAnswers });
      setLoadingExam(false);
    };
    void load();
    return () => { active = false; };
  }, [examId, navigate, notify, submittedAccessCode, startRequest]);
  useEffect(() => {
    const id = window.setInterval(
      () => setRemaining((v) => Math.max(0, v - 1)),
      1000,
    );
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const handler = async () => {
      if (
        document.hidden &&
        examMeta.recordTabSwitches &&
        supabase &&
        attemptId
      ) {
        await supabase.from("integrity_events").insert({
          attempt_id: attemptId,
          student_id: studentId,
          event_type: "tab_hidden",
          metadata: { exam_id: examId },
        });
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [examId, attemptId, examMeta.recordTabSwitches, studentId]);
  useEffect(() => {
    if (!attemptId) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [attemptId]);
  useEffect(() => {
    if (!examMeta.fullscreen || !attemptId) return;
    const enterFullscreen = () => {
      if (!document.fullscreenElement) {
        void document.documentElement.requestFullscreen().catch(() => {
          notify("Mode layar penuh belum aktif. Izinkan fullscreen pada browser.", true);
        });
      }
    };
    document.addEventListener("pointerdown", enterFullscreen, {
      capture: true,
      once: true,
    });
    const recordExit = () => {
      if (!document.fullscreenElement && supabase && !finishingRef.current) {
        void supabase.from("integrity_events").insert({
          attempt_id: attemptId,
          student_id: studentId,
          event_type: "fullscreen_exit",
          metadata: { exam_id: examId },
        });
      }
    };
    document.addEventListener("fullscreenchange", recordExit);
    return () => {
      document.removeEventListener("pointerdown", enterFullscreen, true);
      document.removeEventListener("fullscreenchange", recordExit);
    };
  }, [attemptId, examId, examMeta.fullscreen, notify, studentId]);
  const answeredCount = useMemo(
    () => Object.values(answers).filter((value) =>
      typeof value === "number" || value.trim().length > 0,
    ).length,
    [answers],
  );
  const time = useMemo(
    () =>
      `${String(Math.floor(remaining / 3600)).padStart(2, "0")}:${String(Math.floor((remaining % 3600) / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`,
    [remaining],
  );
  const persistAnswer = useCallback((questionId: string, value: number | string) => {
    const save = async () => {
      if (!supabase || !attemptId) return false;
      setPendingSaves((count) => count + 1);
      try {
        const { error } = await supabase.rpc("save_exam_answer", {
          target_attempt_id: attemptId,
          target_question_id: questionId,
          target_selected_option: typeof value === "number" ? value : null,
          target_essay_text: typeof value === "string" ? value : null,
        });
        if (error) {
          notify(`Jawaban belum tersinkron: ${error.message}`, true);
          return false;
        }
        return true;
      } finally {
        setPendingSaves((count) => Math.max(0, count - 1));
      }
    };
    const previous = answerSaveQueue.current[questionId] ?? Promise.resolve(true);
    const queued = previous.then(save, save);
    answerSaveQueue.current[questionId] = queued;
    void queued.then(() => {
      if (answerSaveQueue.current[questionId] === queued) {
        delete answerSaveQueue.current[questionId];
      }
    });
    return queued;
  }, [attemptId, notify]);
  const answer = (value: number | string) => {
    const next = { ...answers, [question.id]: value };
    setAnswers(next);
    saveLocal(`answers:${examId}`, next);
    void persistAnswer(question.id, value);
  };
  const updateEssay = (value: string) => {
    const questionId = question.id;
    const next = { ...answers, [questionId]: value };
    setAnswers(next);
    saveLocal(`answers:${examId}`, next);
    pendingEssay.current = { questionId, value };
    if (essaySaveTimer.current !== null) window.clearTimeout(essaySaveTimer.current);
    essaySaveTimer.current = window.setTimeout(() => {
      void persistAnswer(questionId, value);
      pendingEssay.current = null;
      essaySaveTimer.current = null;
    }, 600);
  };
  const toggleMarked = (questionId: string) => {
    setMarked((currentMarked) => {
      const nextMarked = currentMarked.includes(questionId)
        ? currentMarked.filter((id) => id !== questionId)
        : [...currentMarked, questionId];
      saveLocal(`marked:${examId}`, nextMarked);
      return nextMarked;
    });
  };
  const finish = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setSubmittingExam(true);
    try {
      if (!supabase || !attemptId) throw new Error("Attempt belum siap.");
      const timeExpired = remaining === 0;
      if (!timeExpired && pendingEssay.current) {
        if (essaySaveTimer.current !== null) window.clearTimeout(essaySaveTimer.current);
        const synced = await persistAnswer(pendingEssay.current.questionId, pendingEssay.current.value);
        if (!synced) throw new Error("Jawaban essay terakhir belum tersimpan. Periksa koneksi lalu coba kembali.");
        pendingEssay.current = null;
        essaySaveTimer.current = null;
      }
      if (timeExpired) {
        await Promise.allSettled(Object.values(answerSaveQueue.current));
      } else {
        const finalSaves = await Promise.all(
          Object.entries(answers).map(([questionId, value]) =>
            persistAnswer(questionId, value),
          ),
        );
        if (finalSaves.some((saved) => !saved)) {
          throw new Error(
            "Masih ada jawaban yang belum tersimpan. Periksa koneksi lalu coba kembali.",
          );
        }
      }
      const { error } = await supabase.rpc("submit_exam_attempt", {
        target_attempt_id: attemptId,
      });
      if (error) throw error;
      localStorage.removeItem(`ruang-ujian:answers:${examId}`);
      localStorage.removeItem(`ruang-ujian:marked:${examId}`);
      if (document.fullscreenElement) await document.exitFullscreen();
      notify("Jawaban berhasil dikumpulkan");
      navigate("/siswa");
    } catch (error) {
      finishingRef.current = false;
      setSubmittingExam(false);
      notify(error instanceof Error ? error.message : "Jawaban gagal dikumpulkan. Coba lagi sebelum meninggalkan halaman.", true);
    }
  }, [answers, attemptId, examId, navigate, notify, persistAnswer, remaining]);
  useEffect(() => () => {
    if (essaySaveTimer.current !== null) window.clearTimeout(essaySaveTimer.current);
  }, []);
  useEffect(() => {
    if (remaining === 0 && attemptId) void finish();
  }, [remaining, attemptId, finish]);
  if (loadingExam) {
    return <div className="auth-loading"><span><BrandLogo /></span><p>Menyiapkan AWExam…</p></div>;
  }
  if (needsAccessCode) {
    return (
      <div className="auth-loading">
        <span><LockKeyhole /></span>
        <p>Masukkan kode akses yang diberikan pengawas.</p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!accessCode.trim()) return;
            setLoadingExam(true);
            setSubmittedAccessCode(accessCode.trim());
            setStartRequest((value) => value + 1);
          }}
        >
          <input
            value={accessCode}
            onChange={(event) => setAccessCode(event.target.value.toUpperCase())}
            placeholder="Kode akses ujian"
            autoFocus
            required
          />
          <button className="primary">Mulai ujian</button>
        </form>
        <button onClick={() => navigate("/siswa")}>Kembali ke beranda</button>
      </div>
    );
  }
  if (examError || !question) {
    return (
      <div className="auth-loading">
        <span><AlertTriangle /></span>
        <p>{examError || "Soal ujian tidak ditemukan."}</p>
        <button className="primary" onClick={() => navigate("/siswa")}>Kembali ke beranda</button>
      </div>
    );
  }
  return (
    <div className="runner">
      <header>
        <div className="runner-brand">
          <BrandLogo />
          <span>
            <small>{examMeta.subject.toUpperCase()} · {examMeta.className.toUpperCase()}</small>
            <b>{examMeta.title}</b>
          </span>
        </div>
        <div className="runner-stats">
          <span>
            <Wifi />
            {pendingSaves > 0 ? `Menyimpan ${pendingSaves}…` : "Tersimpan"}
          </span>
          <p>
            <small>SISA WAKTU</small>
            <b>
              <Clock3 />
              {time}
            </b>
          </p>
          <button onClick={() => setSubmit(true)}>Kumpulkan</button>
        </div>
      </header>
      <main>
        <aside className="question-nav">
          <div>
            <p>
              <b>Daftar Soal</b>
              <span>
                {answeredCount}/{questions.length} terjawab
              </span>
            </p>
            <i>
              <span
                style={{
                  width: `${(answeredCount / questions.length) * 100}%`,
                }}
              />
            </i>
          </div>
          <div className="number-grid">
            {questions.map((q, i) => (
              <button
                className={`${current === i ? "current" : ""} ${answers[q.id] !== undefined ? "answered" : ""} ${marked.includes(q.id) ? "marked" : ""}`}
                onClick={() => setCurrent(i)}
                key={q.id}
              >
                {i + 1}
                {marked.includes(q.id) && <Star />}
              </button>
            ))}
          </div>
          <ul>
            <li>
              <i className="answered" />
              Terjawab
            </li>
            <li>
              <i className="current" />
              Sedang dibuka
            </li>
            <li>
              <i className="marked" />
              Ditandai ragu
            </li>
          </ul>
          <div className="secure-note">
            <ShieldCheck />
            <p>
              <b>
                {examMeta.fullscreen ? "Mode layar penuh" : "Ujian aman"}
              </b>
              <span>
                {examMeta.recordTabSwitches
                  ? "Aktivitas keluar layar dicatat."
                  : "Jawaban disimpan otomatis ke server."}
              </span>
            </p>
          </div>
        </aside>
        <section className="question-area">
          <div className="question-top">
            <span>
              SOAL {current + 1} DARI {questions.length}
            </span>
            <button
              className={marked.includes(question.id) ? "marked" : ""}
              onClick={() => toggleMarked(question.id)}
            >
              <Star />
              Tandai ragu
            </button>
          </div>
          <article>
            <h1>{question.text}</h1>
            <p>{question.type === "essay" ? "Tuliskan jawaban dengan jelas dan lengkap." : "Pilih satu jawaban yang paling tepat."}</p>
            {question.type === "essay" ? (
              <textarea
                className="runner-essay"
                rows={9}
                value={typeof answers[question.id] === "string" ? answers[question.id] : ""}
                onChange={(event) => updateEssay(event.target.value)}
                placeholder="Tulis jawabanmu di sini…"
              />
            ) : (
              <div className="answer-options">
                {question.options.map((option, i) => (
                  <button
                    onClick={() => void answer(i)}
                    className={answers[question.id] === i ? "selected" : ""}
                    key={option}
                  >
                    <span>{String.fromCharCode(65 + i)}</span>
                    <b>{option}</b>
                    {answers[question.id] === i && <Check />}
                  </button>
                ))}
              </div>
            )}
          </article>
          <footer>
            <button
              disabled={current === 0}
              onClick={() => setCurrent(current - 1)}
            >
              <ArrowLeft />
              Sebelumnya
            </button>
            <span>Jawaban tersimpan otomatis</span>
            {current < questions.length - 1 ? (
              <button className="next" onClick={() => setCurrent(current + 1)}>
                Selanjutnya
                <ArrowRight />
              </button>
            ) : (
              <button className="next" onClick={() => setSubmit(true)}>
                Tinjau & kumpulkan
                <Check />
              </button>
            )}
          </footer>
        </section>
      </main>
      {submit && (
        <Modal close={() => setSubmit(false)}>
          <div className="submit-modal">
            <span>
              <ClipboardCheck />
            </span>
            <h2>Kumpulkan jawaban?</h2>
            <p>
              Pastikan semua jawaban sudah diperiksa. Jawaban tidak dapat diubah
              setelah dikumpulkan.
            </p>
            <div>
              <span>
                <b>{answeredCount}</b>Terjawab
              </span>
              <span className="empty">
                <b>{questions.length - answeredCount}</b>Belum
                dijawab
              </span>
              <span className="marked">
                <b>{marked.length}</b>Ditandai
              </span>
            </div>
            <footer>
              <button onClick={() => setSubmit(false)}>Periksa lagi</button>
              <button className="primary" onClick={finish} disabled={submittingExam}>
                {submittingExam ? "Mengirim…" : "Ya, kumpulkan"}
              </button>
            </footer>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default App;
