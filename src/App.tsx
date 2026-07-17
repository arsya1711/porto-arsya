import {
  ComponentProps,
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
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
  ChevronDown,
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
import {
  examQuestions,
  type Exam,
  type Role,
} from "./mockData";
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
import { RealExamRunner } from "./components/ExamRunner";
import { RealSettingsPage } from "./components/SettingsPage";
import { PortalTopbar } from "./components/PortalTopbar";

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
  if (authLoading)
    return (
      <div className="auth-loading">
        <span>
          <GraduationCap />
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
              <RealExamRunner notify={notify} />
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
  const { login, loginDemo, resetPassword } = useAuth();
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
  const demo = (role: Role) => {
    loginDemo(role);
    navigate(role === "siswa" ? "/siswa" : "/app");
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
        <div className="school-mark">
          <GraduationCap />
        </div>
        <div className="brand-copy">
          <span>RUANG UJIAN</span>
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
        <small>© 2026 Ruang Ujian</small>
      </section>
      <section className="login-panel">
        <form onSubmit={submit}>
          <div className="mobile-logo">
            <GraduationCap /> Ruang Ujian
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
          {!isSupabaseConfigured && (
            <>
              <div className="divider">
                <span>atau coba mode demo</span>
              </div>
              <div className="demo-buttons">
                <button type="button" onClick={() => demo("admin")}>
                  Admin
                </button>
                <button type="button" onClick={() => demo("guru")}>
                  Guru
                </button>
                <button type="button" onClick={() => demo("siswa")}>
                  Siswa
                </button>
              </div>
            </>
          )}
          <p className="connection">
            <i className={isSupabaseConfigured ? "online" : ""} />
            {isSupabaseConfigured
              ? "Autentikasi Supabase aktif"
              : "Mode demo lokal aktif"}
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
  const initials = getInitials(profile.full_name);
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
      <aside className="portal-sidebar">
        <Link to="/app" className="portal-logo">
          <span>
            {schoolBrand.logoUrl ? <img src={schoolBrand.logoUrl} alt="Logo sekolah" /> : <GraduationCap />}
          </span>
          <b>
            Ruang Ujian<small>{schoolBrand.name}</small>
          </b>
        </Link>
        <div className="workspace">
          <small>RUANG KERJA</small>
          <button>
            <span>{initials}</span>
            <b>
              {profile.full_name}
              <small>{role === "admin" ? "Administrator" : "Guru"}</small>
            </b>
            <ChevronDown />
          </button>
        </div>
        <nav>
          {nav.map(([to, icon, label]) => (
            <Link
              key={to}
              className={location.pathname === to ? "active" : ""}
              to={to}
            >
              {icon}
              {label}
            </Link>
          ))}
        </nav>
        <div className="side-bottom">
          <Link to="/app/pengaturan">
            <Settings />
            Pengaturan
          </Link>
          <button onClick={logout}>
            <LogOut />
            Keluar
          </button>
        </div>
      </aside>
      <main className="portal-main">
        <Topbar profile={profile} logout={logout} />
        <Routes>
          <Route
            index
            element={<StaffDashboard profile={profile} />}
          />
          <Route
            path="ujian"
            element={role === "guru" ? (
              <RealExamManagement profile={profile} notify={notify} />
            ) : <Navigate to="/app" />}
          />
          <Route
            path="bank-soal"
            element={role === "guru" ? <QuestionBank notify={notify} /> : <Navigate to="/app" />}
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
            element={role === "admin" ? <AcademicYearsPage notify={notify} /> : <Navigate to="/app" />}
          />
          <Route
            path="mata-pelajaran"
            element={role === "admin" ? <SubjectsPage notify={notify} /> : <Navigate to="/app" />}
          />
          <Route
            path="audit"
            element={role === "admin" ? <AuditSecurityPage notify={notify} /> : <Navigate to="/app" />}
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
function Topbar({ profile, logout }: { profile: Profile; logout: () => void }) {
  return <PortalTopbar profile={profile} logout={logout} />;
}

function MobilePortalNav({ role }: { role: Role }) {
  const items = role === "admin"
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
  const addExam = async (exam: Exam) => {
    try {
      if (supabase) {
        const { error } = await supabase.from("exams").insert({
          title: exam.title,
          duration_minutes: exam.duration,
          starts_at: new Date().toISOString(),
          status: "draft",
        });
        if (error) throw error;
      }
      setExams([exam, ...exams]);
      setCreate(false);
      notify("Draft ujian berhasil dibuat");
    } catch {
      notify("Ujian gagal disimpan", true);
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
      <Toolbar placeholder="Cari judul atau mata pelajaran…" />
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
            {exams.map((exam) => (
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
                  <button className="more">
                    <MoreHorizontal />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="table-footer">
          <span>Menampilkan {exams.length} ujian</span>
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
  save: (exam: Exam) => void;
}) {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("Matematika");
  const [className, setClass] = useState("IX A");
  const [duration, setDuration] = useState(90);
  const finish = () =>
    save({
      id: crypto.randomUUID(),
      title,
      subject,
      className,
      date: "Belum dijadwalkan",
      time: "—",
      duration,
      questions: 0,
      status: "draft",
      participants: 32,
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
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  >
                    <option>Matematika</option>
                    <option>IPA</option>
                    <option>Bahasa Indonesia</option>
                  </select>
                </FormField>
                <FormField label="Target kelas">
                  <select
                    value={className}
                    onChange={(e) => setClass(e.target.value)}
                  >
                    <option>IX A</option>
                    <option>IX B</option>
                    <option>VIII A</option>
                  </select>
                </FormField>
              </div>
            </>
          )}
          {step === 2 && (
            <div className="choice-card">
              <FileQuestion />
              <div>
                <b>Ambil dari bank soal</b>
                <p>Pilih soal secara manual setelah draft dibuat.</p>
              </div>
              <span>0 soal dipilih</span>
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
                <FormField label="Kode akses (opsional)">
                  <input placeholder="Contoh: MATH26" />
                </FormField>
              </div>
              <div className="switch-list">
                <label>
                  <span>
                    <b>Acak urutan soal</b>
                    <small>Urutan berbeda untuk setiap siswa</small>
                  </span>
                  <input type="checkbox" defaultChecked />
                </label>
                <label>
                  <span>
                    <b>Mode layar penuh</b>
                    <small>Catat saat siswa keluar dari ujian</small>
                  </span>
                  <input type="checkbox" defaultChecked />
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
                {duration} menit · Soal dapat ditambahkan setelah draft
                tersimpan
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
              disabled={step === 1 && !title.trim()}
              onClick={() => (step < 4 ? setStep(step + 1) : finish())}
            >
              {step < 4 ? "Lanjut" : "Simpan Draft"}
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
  const [selected, setSelected] = useState(0);
  const [scores, setScores] = useState<Record<number, string>>({});
  const names = [
    "Alya Putri",
    "Bima Saputra",
    "Citra Lestari",
    "Dian Pratama",
    "Eka Lestari",
  ];
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
              <b>Soal 3 dari 5</b>
              <span>24 / 32 dinilai</span>
            </p>
            <i>
              <span style={{ width: "75%" }} />
            </i>
          </div>
          <div className="student-answer-list">
            {names.map((n, i) => (
              <button
                onClick={() => setSelected(i)}
                className={selected === i ? "active" : ""}
                key={n}
              >
                <span>
                  {n
                    .split(" ")
                    .map((x) => x[0])
                    .join("")}
                </span>
                <p>
                  <b>{n}</b>
                  <small>
                    {scores[i] ? `Skor ${scores[i]}/10` : "Belum dinilai"}
                  </small>
                </p>
                {scores[i] ? <CheckCircle2 /> : <ChevronRight />}
              </button>
            ))}
          </div>
        </aside>
        <main className="grading-main">
          <div className="question-reference">
            <small>SOAL ESSAY · BOBOT 10 POIN</small>
            <h3>
              Jelaskan dengan bahasamu sendiri bagaimana proses fotosintesis
              terjadi dan faktor apa saja yang memengaruhinya.
            </h3>
            <button>
              <BookOpen />
              Lihat rubrik & kunci jawaban
            </button>
          </div>
          <div className="answer-paper">
            <div>
              <span className="avatar sm">
                {names[selected]
                  .split(" ")
                  .map((x) => x[0])
                  .join("")}
              </span>
              <p>
                <b>{names[selected]}</b>
                <small>Kelas IX A · Tersimpan 09.42</small>
              </p>
            </div>
            <p>
              Fotosintesis adalah proses tumbuhan membuat makanan dengan bantuan
              cahaya matahari. Proses ini terjadi di daun pada bagian klorofil.
              Tumbuhan menggunakan air dari akar dan karbon dioksida dari udara,
              lalu menghasilkan glukosa dan oksigen.
            </p>
            <p>
              Faktor yang memengaruhi yaitu intensitas cahaya, jumlah air, kadar
              karbon dioksida, suhu, dan banyaknya klorofil.
            </p>
          </div>
          <div className="score-panel">
            <FormField label="Skor (maks. 10)">
              <input
                type="number"
                min="0"
                max="10"
                value={scores[selected] ?? ""}
                onChange={(e) =>
                  setScores({ ...scores, [selected]: e.target.value })
                }
                placeholder="0"
              />
            </FormField>
            <FormField label="Komentar untuk siswa (opsional)">
              <input placeholder="Berikan umpan balik singkat…" />
            </FormField>
            <button
              className="primary"
              onClick={() => {
                notify("Nilai berhasil disimpan");
                if (selected < names.length - 1) setSelected(selected + 1);
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
  const grades = [72, 76, 78, 82, 84, 76, 88, 92, 80, 86, 74, 90];
  return (
    <div className="portal-page">
      <PageTitle
        eyebrow="LAPORAN & ANALITIK"
        title="Hasil Ujian"
        description="Analisis capaian kelas dan kualitas soal."
        action={
          <button className="outline">
            <Download />
            Ekspor laporan
          </button>
        }
      />
      <div className="report-filter">
        <select>
          <option>Penilaian Akhir Semester</option>
        </select>
        <select>
          <option>Kelas IX A</option>
        </select>
        <button>Terapkan</button>
      </div>
      <div className="report-stats">
        <div>
          <small>RATA-RATA</small>
          <b>82,4</b>
          <span className="up">↑ 3,2</span>
        </div>
        <div>
          <small>NILAI TERTINGGI</small>
          <b>96</b>
          <span>Alya Putri</span>
        </div>
        <div>
          <small>NILAI TERENDAH</small>
          <b>62</b>
          <span>Perlu pendampingan</span>
        </div>
        <div>
          <small>KETUNTASAN</small>
          <b>87,5%</b>
          <span>28 dari 32 siswa</span>
        </div>
      </div>
      <div className="report-grid">
        <section className="card chart-card">
          <CardHead title="Distribusi nilai" />
          <div className="grade-chart">
            {grades.map((v, i) => (
              <div key={i}>
                <i style={{ height: `${v - 40}%` }} />
                <span>{60 + i * 3}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="card">
          <CardHead title="Ringkasan pengerjaan" />
          <div className="donut-wrap">
            <div className="donut">
              <strong>32</strong>
              <span>peserta</span>
            </div>
            <ul>
              <li>
                <i className="green" />
                Lulus KKM <b>28</b>
              </li>
              <li>
                <i className="amber" />
                Di bawah KKM <b>4</b>
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
        <CardHead title="Analisis butir soal" link="Lihat seluruh soal" />
        <div className="analysis-row">
          <span>01</span>
          <p>
            <b>Persamaan linear satu variabel</b>
            <small>Q-1042 · Pilihan Ganda</small>
          </p>
          <div>
            <small>DIJAWAB BENAR</small>
            <b>91%</b>
          </div>
          <span className="difficulty mudah">Mudah</span>
        </div>
        <div className="analysis-row">
          <span>12</span>
          <p>
            <b>Sistem persamaan linear dua variabel</b>
            <small>Q-1041 · Essay</small>
          </p>
          <div>
            <small>RATA-RATA SKOR</small>
            <b>68%</b>
          </div>
          <span className="difficulty sedang">Sedang</span>
        </div>
      </section>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function SettingsPage({ profile }: { profile: Profile }) {
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
          <button className="active">Profil sekolah</button>
          <button>Keamanan</button>
          <button>Tahun ajaran</button>
          <button>Notifikasi</button>
        </aside>
        <div className="card settings-form">
          <h2>Profil sekolah</h2>
          <p>Informasi ini digunakan pada laporan dan halaman siswa.</p>
          <div className="school-logo">
            <span>
              <GraduationCap />
            </span>
            <button>Ganti logo</button>
          </div>
          <div className="form-grid">
            <FormField label="Nama sekolah">
              <input defaultValue="SMP Negeri Harapan Bangsa" />
            </FormField>
            <FormField label="NPSN">
              <input defaultValue="20123456" />
            </FormField>
          </div>
          <FormField label="Alamat">
            <textarea rows={3} defaultValue="Jl. Pendidikan No. 17, Jakarta" />
          </FormField>
          <div className="settings-save">
            <button className="primary">Simpan perubahan</button>
            <span>Anda masuk sebagai Admin.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ExamRunner({
  notify,
}: {
  notify: (text: string, error?: boolean) => void;
}) {
  const { examId = "1" } = useParams();
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>(() =>
    loadLocal(`answers:${examId}`, {}),
  );
  const [marked, setMarked] = useState<string[]>([]);
  const [remaining, setRemaining] = useState(89 * 60 + 42);
  const [submit, setSubmit] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const question = examQuestions[current];
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    client.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const existing = await client
        .from("attempts")
        .select("id")
        .eq("exam_id", examId)
        .eq("student_id", data.user.id)
        .maybeSingle();
      if (existing.data) {
        setAttemptId(existing.data.id);
      } else {
        const created = await client
          .from("attempts")
          .insert({
            exam_id: examId,
            student_id: data.user.id,
            status: "in_progress",
            started_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (created.data) setAttemptId(created.data.id);
      }
    });
  }, [examId]);
  useEffect(() => {
    const id = window.setInterval(
      () => setRemaining((v) => Math.max(0, v - 1)),
      1000,
    );
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (remaining === 0) setSubmit(true);
  }, [remaining]);
  useEffect(() => {
    const handler = async () => {
      if (document.hidden && supabase && attemptId) {
        await supabase.from("integrity_events").insert({
          attempt_id: attemptId,
          event_type: "tab_hidden",
          metadata: { exam_id: examId },
        });
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [examId, attemptId]);
  const time = useMemo(
    () =>
      `${String(Math.floor(remaining / 3600)).padStart(2, "0")}:${String(Math.floor((remaining % 3600) / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`,
    [remaining],
  );
  const answer = async (option: number) => {
    const next = { ...answers, [question.id]: option };
    setAnswers(next);
    saveLocal(`answers:${examId}`, next);
    if (supabase && attemptId) {
      await supabase.from("answers").upsert(
        {
          attempt_id: attemptId,
          question_id: question.id,
          selected_option: option,
          answered_at: new Date().toISOString(),
        },
        { onConflict: "attempt_id,question_id" },
      );
    }
  };
  const finish = async () => {
    try {
      if (supabase && attemptId) {
        const { error } = await supabase
          .from("attempts")
          .update({
            status: "submitted",
            submitted_at: new Date().toISOString(),
          })
          .eq("id", attemptId);
        if (error) throw error;
      }
      localStorage.removeItem(`ruang-ujian:answers:${examId}`);
      notify("Jawaban berhasil dikumpulkan");
      navigate("/siswa");
    } catch {
      notify("Jawaban tersimpan lokal dan akan dikirim saat online");
    }
  };
  return (
    <div className="runner">
      <header>
        <div className="runner-brand">
          <GraduationCap />
          <span>
            <small>MATEMATIKA · KELAS IX</small>
            <b>Penilaian Akhir Semester</b>
          </span>
        </div>
        <div className="runner-stats">
          <span>
            <Wifi />
            Tersimpan
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
                {Object.keys(answers).length}/{examQuestions.length} terjawab
              </span>
            </p>
            <i>
              <span
                style={{
                  width: `${(Object.keys(answers).length / examQuestions.length) * 100}%`,
                }}
              />
            </i>
          </div>
          <div className="number-grid">
            {examQuestions.map((q, i) => (
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
              <b>Ujian aman</b>
              <span>Aktivitas keluar layar dicatat.</span>
            </p>
          </div>
        </aside>
        <section className="question-area">
          <div className="question-top">
            <span>
              SOAL {current + 1} DARI {examQuestions.length}
            </span>
            <button
              className={marked.includes(question.id) ? "marked" : ""}
              onClick={() =>
                setMarked((m) =>
                  m.includes(question.id)
                    ? m.filter((x) => x !== question.id)
                    : [...m, question.id],
                )
              }
            >
              <Star />
              Tandai ragu
            </button>
          </div>
          <article>
            <h1>{question.text}</h1>
            <p>Pilih satu jawaban yang paling tepat.</p>
            <div className="answer-options">
              {question.options.map((option, i) => (
                <button
                  onClick={() => answer(i)}
                  className={answers[question.id] === i ? "selected" : ""}
                  key={option}
                >
                  <span>{String.fromCharCode(65 + i)}</span>
                  <b>{option}</b>
                  {answers[question.id] === i && <Check />}
                </button>
              ))}
            </div>
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
            {current < examQuestions.length - 1 ? (
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
                <b>{Object.keys(answers).length}</b>Terjawab
              </span>
              <span className="empty">
                <b>{examQuestions.length - Object.keys(answers).length}</b>Belum
                dijawab
              </span>
              <span className="marked">
                <b>{marked.length}</b>Ditandai
              </span>
            </div>
            <footer>
              <button onClick={() => setSubmit(false)}>Periksa lagi</button>
              <button className="primary" onClick={finish}>
                Ya, kumpulkan
              </button>
            </footer>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default App;
