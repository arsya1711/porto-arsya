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
  NavLink,
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
  BookOpenCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  Download,
  Eye,
  EyeOff,
  FileQuestion,
  Filter,
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
import { type Role, type StudentExamCatalogRow } from "./types";
import {
  isSupabaseConfigured,
  loadLocal,
  saveLocal,
  supabase,
} from "./lib/supabase";
import { AuthProvider } from "./auth/AuthContext";
import { type Profile, useAuth } from "./auth/auth-context";
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
import { ReportCardsPage } from "./components/ReportCardsPage";
import {
  isAnsweredValue,
  normalizeStoredAnswers,
} from "./lib/exam-answer-state";
import {
  formatExamRemaining,
  parseExamDeadline,
  remainingSecondsFromDeadline,
} from "./lib/exam-timer";

type Toast = { text: string; error?: boolean } | null;

const DEFAULT_SCHOOL_NAME = "Mts Alhidayah Wattaqwa";

function formatSchoolName(name?: string | null) {
  const cleanName = name?.trim() || DEFAULT_SCHOOL_NAME;
  return /^mts(?:\s|$)/i.test(cleanName)
    ? cleanName.replace(/^mts\b/i, "Mts")
    : `Mts ${cleanName}`;
}

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
          <span>{DEFAULT_SCHOOL_NAME}</span>
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
              <small>{DEFAULT_SCHOOL_NAME}</small>
            </span>
          </div>
          <p className="overline">PORTAL SEKOLAH</p>
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
  const [schoolBrand, setSchoolBrand] = useState({ name: DEFAULT_SCHOOL_NAME, logoUrl: "" });
  useEffect(() => {
    const loadBrand = async () => {
      if (!supabase) return;
      const { data } = await supabase.from("school_profile_settings").select("school_name,logo_url").eq("id", 1).maybeSingle();
      if (data) setSchoolBrand({ name: formatSchoolName(data.school_name), logoUrl: data.logo_url || "" });
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
  type NavItem = [string, ReactNode, string];
  type NavGroup = { label: string; items: NavItem[] };
  const teacherNav: NavGroup[] = [
    {
      label: "Utama",
      items: [["/app", <LayoutDashboard />, "Ringkasan"]],
    },
    {
      label: "Persiapan ujian",
      items: [
        ["/app/bank-soal", <FileQuestion />, "Bank Soal"],
        ["/app/ujian", <CalendarDays />, "Ujian"],
        ["/app/kelas", <Users />, "Kelas & Siswa"],
      ],
    },
    {
      label: "Penilaian",
      items: [
        ["/app/koreksi", <ClipboardCheck />, "Koreksi Essay"],
        ["/app/laporan", <BarChart3 />, "Hasil Ujian"],
        ["/app/rapor", <BookOpenCheck />, "Rapor Semester"],
      ],
    },
  ];
  const adminNav: NavGroup[] = [
    {
      label: "Utama",
      items: [["/app", <LayoutDashboard />, "Ringkasan"]],
    },
    {
      label: "Akademik",
      items: [
        ["/app/tahun-ajaran", <CalendarDays />, "Tahun Ajaran"],
        ["/app/mata-pelajaran", <BookOpen />, "Mata Pelajaran"],
        ["/app/kelas", <Users />, "Kelas & Siswa"],
      ],
    },
    {
      label: "Akses pengguna",
      items: [
        ["/app/guru", <UserRound />, "Guru"],
        ["/app/admin", <ShieldCheck />, "Administrator"],
      ],
    },
    {
      label: "Pemantauan",
      items: [
        ["/app/laporan", <BarChart3 />, "Hasil Ujian"],
        ["/app/rapor", <BookOpenCheck />, "Rapor Semester"],
        ["/app/audit", <LockKeyhole />, "Audit & Keamanan"],
      ],
    },
  ];
  const navGroups = role === "admin" ? adminNav : teacherNav;
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
    const target = document.querySelector<HTMLElement>(".portal-page");
    if (!target || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    void import("gsap").then(({ gsap }) => {
      if (!cancelled) {
        animation = gsap.fromTo(
          target,
          { autoAlpha: 0, y: 14 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.38,
            ease: "power2.out",
            // Transform pada ancestor mengubah containing block elemen
            // position:fixed. Jika dibiarkan, modal di halaman panjang akan
            // dipusatkan jauh di bawah viewport dan hanya overlay yang tampak.
            clearProps: "transform,translate,rotate,scale,opacity,visibility",
          },
        );
      }
    });
    return () => {
      cancelled = true;
      animation?.kill();
      target.style.removeProperty("transform");
      target.style.removeProperty("translate");
      target.style.removeProperty("rotate");
      target.style.removeProperty("scale");
      target.style.removeProperty("opacity");
      target.style.removeProperty("visibility");
    };
  }, [location.pathname]);
  return (
    <div className={`portal-shell role-${role}`}>
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
          {navGroups.map((group) => (
            <div className="portal-nav-group" role="group" aria-label={group.label} key={group.label}>
              <p>{group.label}</p>
              {group.items.map(([to, icon, label]) => (
                <Link
                  key={to}
                  className={location.pathname === to ? "active" : ""}
                  to={to}
                  aria-current={location.pathname === to ? "page" : undefined}
                  onClick={() => setMobileNavigationOpen(false)}
                >
                  {icon}
                  {label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="side-bottom">
          <Link
            to="/app/pengaturan"
            className={location.pathname === "/app/pengaturan" ? "active" : ""}
            aria-current={location.pathname === "/app/pengaturan" ? "page" : undefined}
            onClick={() => setMobileNavigationOpen(false)}
          >
            <Settings />
            Pengaturan
          </Link>
          <button type="button" onClick={() => { setMobileNavigationOpen(false); void logout(); }}>
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
          <Route
            path="rapor"
            element={<ReportCardsPage profile={profile} notify={notify} />}
          />
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
        <NavLink to={to as string} key={to as string} end={to === "/app"}>
          {icon}
          <span>{label}</span>
        </NavLink>
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
type ClassOption = {
  id: string;
  name: string;
  academic_year_id: string | null;
  academic_year_name: string;
};
type AcademicYearOption = { id: string; name: string; active: boolean };
type SubjectOption = { id: string; name: string };

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
  const [assigning, setAssigning] = useState<ManagedUser | null>(null);
  const [query, setQuery] = useState("");
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [classFilter, setClassFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [academicYears, setAcademicYears] = useState<AcademicYearOption[]>([]);
  const [classEditor, setClassEditor] = useState<ClassOption | "new" | null>(
    null,
  );
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
      roleFilter === "siswa" || roleFilter === "guru"
        ? supabase
            .from("classes")
            .select("id,name,academic_year_id,academic_years(name)")
            .order("name")
        : Promise.resolve({
            data: [] as {
              id: string;
              name: string;
              academic_year_id: string | null;
              academic_years: unknown;
            }[],
            error: null,
          });
    const academicYearQuery =
      roleFilter === "siswa" && canManage
        ? supabase
            .from("academic_years")
            .select("id,name,active")
            .order("name", { ascending: false })
        : Promise.resolve({
            data: [] as AcademicYearOption[],
            error: null,
          });
    const subjectQuery =
      roleFilter === "guru"
        ? supabase.from("subjects").select("id,name").order("name")
        : Promise.resolve({ data: [] as SubjectOption[], error: null });
    const [profileResult, classResult, subjectResult, academicYearResult] =
      await Promise.all([
        profileQuery,
        classQuery,
        subjectQuery,
        academicYearQuery,
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
    else {
      setClasses(
        (classResult.data ?? []).map((item) => {
          const academicYearName = relationName(item.academic_years);
          return {
            id: item.id,
            name: item.name,
            academic_year_id: item.academic_year_id,
            academic_year_name:
              academicYearName === "—" ? "Belum diatur" : academicYearName,
          };
        }),
      );
    }
    if (subjectResult.error) notify(subjectResult.error.message, true);
    else setSubjects((subjectResult.data ?? []) as SubjectOption[]);
    if (academicYearResult.error) {
      notify(academicYearResult.error.message, true);
    } else {
      setAcademicYears(
        (academicYearResult.data ?? []) as AcademicYearOption[],
      );
    }
    setLoading(false);
  }, [canManage, notify, roleFilter]);
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
  const saveClass = async (draft: {
    id?: string;
    name: string;
    academicYearId: string;
  }) => {
    if (!supabase) return;
    const payload = {
      name: draft.name.trim(),
      academic_year_id: draft.academicYearId,
    };
    const result = draft.id
      ? await supabase.from("classes").update(payload).eq("id", draft.id)
      : await supabase.from("classes").insert(payload);
    if (result.error) {
      notify(result.error.message, true);
      return false;
    }
    setClassEditor(null);
    notify(
      draft.id
        ? "Kelas dan tahun ajaran berhasil diperbarui."
        : "Kelas berhasil ditambahkan.",
    );
    await loadUsers();
    return true;
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
  const selectedClassOption = classes.find(
    (item) => item.id === classFilter,
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
    <div className="portal-page user-management-page">
      <PageTitle
        eyebrow="ADMINISTRASI AKUN"
        title={title}
        description={description}
        action={
          canManage ? (
            <div className="title-actions">
              {roleFilter === "siswa" && (
                <details className="page-action-menu">
                  <summary>
                    <MoreHorizontal /> Kelola kelas <ChevronDown />
                  </summary>
                  <div>
                    <button
                      type="button"
                      onClick={(event) => {
                        setClassEditor("new");
                        event.currentTarget.closest("details")?.removeAttribute("open");
                      }}
                    >
                      <Plus /> Tambah kelas
                    </button>
                    <button
                      type="button"
                      disabled={!selectedClassOption}
                      onClick={(event) => {
                        if (selectedClassOption) setClassEditor(selectedClassOption);
                        event.currentTarget.closest("details")?.removeAttribute("open");
                      }}
                    >
                      <Pencil /> Ubah kelas terpilih
                    </button>
                    <button
                      type="button"
                      className="danger"
                      disabled={!classFilter}
                      onClick={(event) => {
                        event.currentTarget.closest("details")?.removeAttribute("open");
                        void deleteClass();
                      }}
                    >
                      <Trash2 /> Hapus kelas terpilih
                    </button>
                  </div>
                </details>
              )}
              <button className="primary" onClick={() => setCreate(true)}>
                <UserPlus />
                Tambah {roleFilter === "siswa" ? "siswa" : roleFilter === "guru" ? "guru" : "admin"}
              </button>
            </div>
          ) : undefined
        }
      />
      {roleFilter === "siswa" && (
        <>
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
          {selectedClassOption && (
            <div
              className={`class-year-context ${
                selectedClassOption.academic_year_id ? "" : "missing"
              }`}
            >
              <CalendarDays />
              <span>
                <b>{selectedClassOption.name}</b>
                Tahun ajaran: {selectedClassOption.academic_year_name}
              </span>
              {canManage && (
                <button
                  type="button"
                  onClick={() => setClassEditor(selectedClassOption)}
                >
                  Ubah
                </button>
              )}
            </div>
          )}
        </>
      )}
      <Toolbar
        placeholder={roleFilter === "siswa" ? "Cari nama, email, atau NIS…" : "Cari nama atau email…"}
        value={query}
        onChange={setQuery}
        filterValue={activeFilter}
        onFilterChange={setActiveFilter}
        onExport={exportUsers}
      />
      <div className="table-card users-table responsive-card-table">
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
                  <td data-label="Pengguna">
                    <div className="student-cell">
                      <span>{getInitials(user.full_name)}</span>
                      <p>
                        <b>{user.full_name}</b>
                        <small>{user.email}</small>
                      </p>
                    </div>
                  </td>
                  <td data-label={roleFilter === "siswa" ? "Kelas" : "Peran"}>
                    {roleFilter === "siswa" ? (
                      user.class_name || "Belum ditempatkan"
                    ) : (
                      <span className={`role-badge ${user.role}`}>
                        {capitalize(user.role)}
                      </span>
                    )}
                  </td>
                  {roleFilter === "siswa" && <td data-label="NIS">{user.student_number || "—"}</td>}
                  <td data-label="Status">
                    <span
                      className={`user-status ${user.active ? "active" : ""}`}
                    >
                      <i />
                      {user.active ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td data-label="Dibuat">
                    {new Date(user.created_at).toLocaleDateString("id-ID")}
                  </td>
                  <td data-label="Aksi">
                    {canManage && (
                      <div className="user-actions">
                        <button
                          onClick={() => setEditing(user)}
                          title="Edit pengguna"
                          aria-label={`Edit ${user.full_name}`}
                        >
                          <Pencil />
                        </button>
                        <details className="user-row-menu">
                          <summary>
                            <MoreHorizontal /> Aksi lain <ChevronDown />
                          </summary>
                          <div>
                            <button
                              onClick={(event) => {
                                setResetting(user);
                                event.currentTarget.closest("details")?.removeAttribute("open");
                              }}
                            >
                              <LockKeyhole /> Reset kata sandi
                            </button>
                            {roleFilter === "guru" && (
                              <button
                                onClick={(event) => {
                                  setAssigning(user);
                                  event.currentTarget.closest("details")?.removeAttribute("open");
                                }}
                              >
                                <BookOpen /> Atur penugasan
                              </button>
                            )}
                            <button
                              onClick={(event) => {
                                event.currentTarget.closest("details")?.removeAttribute("open");
                                void toggleUser(user);
                              }}
                            >
                              {user.active ? "Nonaktifkan akun" : "Aktifkan akun"}
                            </button>
                            <button
                              className="danger"
                              onClick={(event) => {
                                event.currentTarget.closest("details")?.removeAttribute("open");
                                void deleteUser(user);
                              }}
                            >
                              <Trash2 /> Hapus pengguna
                            </button>
                          </div>
                        </details>
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
      {assigning && (
        <TeacherAssignmentsModal
          teacher={assigning}
          classes={classes}
          subjects={subjects}
          close={() => setAssigning(null)}
          notify={notify}
        />
      )}
      {classEditor && (
        <ClassEditorModal
          initial={classEditor === "new" ? undefined : classEditor}
          academicYears={academicYears}
          close={() => setClassEditor(null)}
          save={saveClass}
        />
      )}
    </div>
  );
}

function ClassEditorModal({
  initial,
  academicYears,
  close,
  save,
}: {
  initial?: ClassOption;
  academicYears: AcademicYearOption[];
  close: () => void;
  save: (draft: {
    id?: string;
    name: string;
    academicYearId: string;
  }) => Promise<boolean | undefined>;
}) {
  const defaultAcademicYearId =
    initial?.academic_year_id ??
    academicYears.find((item) => item.active)?.id ??
    academicYears[0]?.id ??
    "";
  const [name, setName] = useState(initial?.name ?? "");
  const [academicYearId, setAcademicYearId] = useState(
    defaultAcademicYearId,
  );
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !academicYearId || saving) return;
    setSaving(true);
    const saved = await save({
      id: initial?.id,
      name,
      academicYearId,
    });
    if (!saved) setSaving(false);
  };

  return (
    <Modal close={close}>
      <form className="simple-modal class-editor-modal" onSubmit={submit}>
        <header>
          <div>
            <p>DATA KELAS</p>
            <h2>{initial ? "Atur kelas" : "Tambah kelas"}</h2>
          </div>
          <button type="button" onClick={close} aria-label="Tutup pengaturan kelas">
            <X />
          </button>
        </header>
        <div className="modal-content">
          <p className="class-editor-intro">
            Setiap kelas wajib terhubung ke satu tahun ajaran agar data ujian,
            nilai, dan rapor masuk ke periode yang benar.
          </p>
          {!academicYears.length && (
            <p className="question-form-error">
              Belum ada tahun ajaran. Buat tahun ajaran terlebih dahulu melalui
              menu Tahun Ajaran.
            </p>
          )}
          <FormField label="Nama kelas">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Contoh: IX A"
              autoFocus
              required
            />
          </FormField>
          <FormField label="Tahun ajaran">
            <select
              value={academicYearId}
              onChange={(event) => setAcademicYearId(event.target.value)}
              required
            >
              <option value="">Pilih tahun ajaran</option>
              {academicYears.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.active ? " — Aktif" : ""}
                </option>
              ))}
            </select>
          </FormField>
        </div>
        <footer>
          <button type="button" onClick={close}>
            Batal
          </button>
          <button
            className="primary"
            type="submit"
            disabled={!name.trim() || !academicYearId || saving}
          >
            {saving ? "Menyimpan…" : initial ? "Simpan perubahan" : "Tambah kelas"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}

type TeacherAssignmentRow = {
  teacher_id: string;
  subject_id: string;
  class_id: string;
  subjects: unknown;
  classes: unknown;
};

function TeacherAssignmentsModal({
  teacher,
  classes,
  subjects,
  close,
  notify,
}: {
  teacher: ManagedUser;
  classes: ClassOption[];
  subjects: SubjectOption[];
  close: () => void;
  notify: (text: string, error?: boolean) => void;
}) {
  const [assignments, setAssignments] = useState<TeacherAssignmentRow[]>([]);
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadAssignments = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("teacher_subjects")
      .select("teacher_id,subject_id,class_id,subjects(name),classes(name)")
      .eq("teacher_id", teacher.id)
      .order("subject_id");
    if (error) notify(error.message, true);
    else setAssignments((data ?? []) as unknown as TeacherAssignmentRow[]);
    setLoading(false);
  }, [notify, teacher.id]);

  useEffect(() => {
    void loadAssignments();
  }, [loadAssignments]);

  const addAssignment = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !subjectId || !classId || saving) return;
    if (
      assignments.some(
        (item) => item.subject_id === subjectId && item.class_id === classId,
      )
    ) {
      notify("Penugasan tersebut sudah tersedia.", true);
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("teacher_subjects").insert({
      teacher_id: teacher.id,
      subject_id: subjectId,
      class_id: classId,
    });
    setSaving(false);
    if (error) {
      notify(error.message, true);
      return;
    }
    notify("Guru berhasil ditugaskan ke mata pelajaran dan kelas.");
    await loadAssignments();
  };

  const removeAssignment = async (assignment: TeacherAssignmentRow) => {
    if (!supabase || saving) return;
    const subjectName = relationName(assignment.subjects);
    const className = relationName(assignment.classes);
    if (
      !window.confirm(
        `Hapus penugasan ${subjectName} di ${className} dari ${teacher.full_name}?`,
      )
    )
      return;
    setSaving(true);
    const { error } = await supabase
      .from("teacher_subjects")
      .delete()
      .eq("teacher_id", teacher.id)
      .eq("subject_id", assignment.subject_id)
      .eq("class_id", assignment.class_id);
    setSaving(false);
    if (error) {
      notify(error.message, true);
      return;
    }
    notify("Penugasan guru berhasil dihapus.");
    await loadAssignments();
  };

  const missingMasterData = !subjects.length || !classes.length;

  return (
    <Modal close={close} wide>
      <div className="simple-modal teacher-assignment-modal">
        <header>
          <div>
            <p>PENUGASAN GURU</p>
            <h2>{teacher.full_name}</h2>
          </div>
          <button type="button" onClick={close} aria-label="Tutup penugasan">
            <X />
          </button>
        </header>
        <div className="modal-content">
          <p className="teacher-assignment-intro">
            Pilih pasangan mata pelajaran dan kelas yang boleh dikelola guru.
            Penugasan ini diperlukan sebelum guru dapat membuat ujian.
          </p>
          {missingMasterData ? (
            <p className="question-form-error">
              {!subjects.length
                ? "Buat mata pelajaran terlebih dahulu."
                : "Buat kelas terlebih dahulu melalui menu Kelas & Siswa."}
            </p>
          ) : (
            <form className="teacher-assignment-form" onSubmit={addAssignment}>
              <label className="form-field">
                <span>Mata pelajaran</span>
                <select
                  value={subjectId}
                  onChange={(event) => setSubjectId(event.target.value)}
                >
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>Kelas</span>
                <select
                  value={classId}
                  onChange={(event) => setClassId(event.target.value)}
                >
                  {classes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <button className="primary" disabled={saving}>
                <Plus /> {saving ? "Menyimpan…" : "Tambahkan penugasan"}
              </button>
            </form>
          )}
          <section className="teacher-assignment-list" aria-live="polite">
            <h3>Penugasan aktif</h3>
            {loading ? (
              <p>Memuat penugasan…</p>
            ) : assignments.length ? (
              assignments.map((assignment) => (
                <article key={`${assignment.subject_id}:${assignment.class_id}`}>
                  <span>
                    <b>{relationName(assignment.subjects)}</b>
                    <small>{relationName(assignment.classes)}</small>
                  </span>
                  <button
                    type="button"
                    className="danger"
                    disabled={saving}
                    onClick={() => void removeAssignment(assignment)}
                    aria-label={`Hapus penugasan ${relationName(assignment.subjects)} ${relationName(assignment.classes)}`}
                  >
                    <Trash2 />
                  </button>
                </article>
              ))
            ) : (
              <p>Guru belum mempunyai penugasan.</p>
            )}
          </section>
        </div>
        <footer>
          <button type="button" onClick={close}>Selesai</button>
        </footer>
      </div>
    </Modal>
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
    normalizeStoredAnswers(loadLocal<unknown>(`answers:${examId}`, {})),
  );
  const [marked, setMarked] = useState<string[]>(() =>
    loadLocal(`marked:${examId}`, []),
  );
  const [remaining, setRemaining] = useState(0);
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
  const deadlineRef = useRef<number | null>(null);
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
      deadlineRef.current = null;
      setRemaining(0);
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
        if (examRow.requires_access_code) {
          setNeedsAccessCode(true);
          setExamError(submittedAccessCode ? "Kode akses salah atau batas percobaan telah tercapai." : "");
        } else {
          setExamError("Server tidak dapat memulai attempt ujian.");
        }
        setLoadingExam(false);
        return;
      }
      setAttemptId(startedAttempt.attempt_id);
      setNeedsAccessCode(false);
      const deadlineTime = parseExamDeadline(startedAttempt.deadline);
      if (deadlineTime === null) {
        setExamError("Batas waktu ujian dari server tidak valid. Hubungi pengawas.");
        setLoadingExam(false);
        return;
      }
      deadlineRef.current = deadlineTime;
      if (deadlineTime <= Date.now()) {
        const localAnswers = loadLocal<Record<string, number | string>>(`answers:${examId}`, {});
        const localAnswerEntries = Object.entries(localAnswers);
        let expiredSaveFailed = localAnswerEntries.length > 0 && Date.now() - deadlineTime > 10_000;
        if (Date.now() - deadlineTime <= 10_000) {
          const expiredSaves = await Promise.all(localAnswerEntries.map(([questionId, value]) =>
            client.rpc("save_exam_answer", {
              target_attempt_id: startedAttempt.attempt_id,
              target_question_id: questionId,
              target_selected_option: typeof value === "number" ? value : null,
              target_essay_text: typeof value === "string" ? value : null,
            }),
          ));
          expiredSaveFailed = expiredSaves.some(({ error }) => Boolean(error));
        }
        const expiredSubmit = await client.rpc("submit_exam_attempt", { target_attempt_id: startedAttempt.attempt_id });
        if (!expiredSubmit.error) {
          if (!expiredSaveFailed) {
            localStorage.removeItem(`ruang-ujian:answers:${examId}`);
          }
          localStorage.removeItem(`ruang-ujian:marked:${examId}`);
          notify(
            expiredSaveFailed
              ? "Waktu ujian berakhir. Sebagian jawaban lokal tidak dapat disinkronkan; salinannya tetap tersimpan di perangkat ini."
              : "Waktu ujian berakhir. Jawaban yang tersimpan telah dikumpulkan.",
            expiredSaveFailed,
          );
          navigate("/siswa");
          return;
        }
      }
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
      setRemaining(remainingSecondsFromDeadline(deadlineTime));
      const localAnswers = normalizeStoredAnswers(
        loadLocal<unknown>(`answers:${examId}`, {}),
      );
      setAnswers({ ...remoteAnswers, ...localAnswers });
      setLoadingExam(false);
    };
    void load();
    return () => { active = false; };
  }, [examId, navigate, notify, submittedAccessCode, startRequest]);
  useEffect(() => {
    const updateRemaining = () => {
      if (deadlineRef.current === null) return;
      setRemaining(
        remainingSecondsFromDeadline(deadlineRef.current),
      );
    };
    const id = window.setInterval(updateRemaining, 1000);
    document.addEventListener("visibilitychange", updateRemaining);
    window.addEventListener("focus", updateRemaining);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", updateRemaining);
      window.removeEventListener("focus", updateRemaining);
    };
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
        const requestFullscreen = document.documentElement.requestFullscreen;
        if (typeof requestFullscreen !== "function") {
          notify("Browser ini tidak mendukung mode layar penuh.", true);
          return;
        }
        void requestFullscreen.call(document.documentElement).catch(() => {
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
    () => Object.values(answers).filter(isAnsweredValue).length,
    [answers],
  );
  const time = useMemo(() => formatExamRemaining(remaining), [remaining]);
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
  useEffect(() => {
    if (remaining > 3 || !pendingEssay.current || !attemptId) return;
    if (essaySaveTimer.current !== null) window.clearTimeout(essaySaveTimer.current);
    const pending = pendingEssay.current;
    pendingEssay.current = null;
    essaySaveTimer.current = null;
    void persistAnswer(pending.questionId, pending.value);
  }, [attemptId, persistAnswer, remaining]);
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
      if (pendingEssay.current) {
        if (essaySaveTimer.current !== null) window.clearTimeout(essaySaveTimer.current);
        const synced = await persistAnswer(pendingEssay.current.questionId, pendingEssay.current.value);
        if (!synced) throw new Error("Jawaban essay terakhir belum tersimpan. Periksa koneksi lalu coba kembali.");
        pendingEssay.current = null;
        essaySaveTimer.current = null;
      }
      await Promise.allSettled(Object.values(answerSaveQueue.current));
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
  }, [answers, attemptId, examId, navigate, notify, persistAnswer]);
  useEffect(() => () => {
    if (essaySaveTimer.current !== null) window.clearTimeout(essaySaveTimer.current);
  }, []);
  useEffect(() => {
    if (!loadingExam && remaining === 0 && attemptId) void finish();
  }, [remaining, attemptId, finish, loadingExam]);
  if (loadingExam) {
    return <div className="auth-loading"><span><BrandLogo /></span><p>Menyiapkan AWExam…</p></div>;
  }
  if (needsAccessCode) {
    return (
      <div className="auth-loading">
        <span><LockKeyhole /></span>
        <p>{examError || "Masukkan kode akses yang diberikan pengawas."}</p>
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
  const saveStatus = pendingSaves > 0
    ? `Menyimpan ${pendingSaves} jawaban…`
    : "Semua jawaban tersimpan";
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
          <span className={pendingSaves > 0 ? "syncing" : "synced"} role="status" aria-live="polite" title={saveStatus}>
            <Wifi />
            {saveStatus}
          </span>
          <time
            className={`runner-timer${remaining <= 300 ? " urgent" : remaining <= 900 ? " warning" : ""}`}
            dateTime={`PT${remaining}S`}
            aria-label={`Sisa waktu ${time}`}
          >
            <small>SISA WAKTU</small>
            <b>
              <Clock3 aria-hidden="true" />
              {time}
            </b>
          </time>
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
                    key={`${question.id}-${i}`}
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
            <span role="status" aria-live="polite">{saveStatus}</span>
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
