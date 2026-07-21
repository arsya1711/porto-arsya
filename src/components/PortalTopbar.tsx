import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bell,
  BookOpen,
  CalendarDays,
  CircleHelp,
  Clock3,
  FileQuestion,
  GraduationCap,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import type { Profile } from "../auth/AuthContext";
import { supabase } from "../lib/supabase";

type SearchResult = { id: string; title: string; detail: string; href: string; icon: "user" | "class" | "subject" | "exam" | "question" };
type Notice = { id: string; title: string; detail: string; time: string; href: string };

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function resultIcon(kind: SearchResult["icon"]) {
  if (kind === "user") return <UserRound />;
  if (kind === "class") return <Users />;
  if (kind === "subject") return <BookOpen />;
  if (kind === "exam") return <CalendarDays />;
  return <FileQuestion />;
}

function auditTitle(action: string) {
  const labels: Record<string, string> = {
    "user.created": "Akun pengguna dibuat",
    "user.updated": "Akun pengguna diperbarui",
    "user.deleted": "Akun pengguna dihapus",
    "user.activated": "Akun pengguna diaktifkan",
    "user.deactivated": "Akun pengguna dinonaktifkan",
    "user.password_reset": "Kata sandi pengguna direset",
    "academic_years.insert": "Tahun ajaran ditambahkan",
    "academic_years.update": "Tahun ajaran diperbarui",
    "academic_years.delete": "Tahun ajaran dihapus",
    "subjects.insert": "Mata pelajaran ditambahkan",
    "subjects.update": "Mata pelajaran diperbarui",
    "subjects.delete": "Mata pelajaran dihapus",
    "classes.insert": "Kelas ditambahkan",
    "classes.delete": "Kelas dihapus",
  };
  return labels[action] ?? action.replace(/[._]/g, " ");
}

export function PortalTopbar({
  profile,
  logout,
  onOpenNavigation,
}: {
  profile: Profile;
  logout: () => void;
  onOpenNavigation: () => void;
}) {
  const navigate = useNavigate();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [noticeLoading, setNoticeLoading] = useState(false);

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setMobileSearchOpen(true);
        window.requestAnimationFrame(() => searchRef.current?.focus());
      }
      if (event.key === "Escape") {
        setQuery("");
        setMobileSearchOpen(false);
        setHelpOpen(false);
        setNoticeOpen(false);
        setAccountOpen(false);
      }
    };
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client || query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      const term = query.trim().replace(/[%_,]/g, " ");
      const profileQuery = client.from("profiles").select("id,full_name,email,role").or(`full_name.ilike.%${term}%,email.ilike.%${term}%`).limit(5);
      const classQuery = client.from("classes").select("id,name").ilike("name", `%${term}%`).limit(4);
      const subjectQuery = client.from("subjects").select("id,name,code").or(`name.ilike.%${term}%,code.ilike.%${term}%`).limit(4);
      const examQuery = client.from("exams").select("id,title").ilike("title", `%${term}%`).limit(5);
      const questionQuery = profile.role === "guru"
        ? client.from("questions").select("id,body").ilike("body", `%${term}%`).eq("archived", false).limit(5)
        : Promise.resolve({ data: [], error: null });
      const [profiles, classes, subjects, exams, questions] = await Promise.all([profileQuery, classQuery, subjectQuery, examQuery, questionQuery]);
      if (!active) return;
      const next: SearchResult[] = [
        ...(profiles.data ?? []).map((item) => ({ id: `user-${item.id}`, title: item.full_name, detail: `${item.email} · ${item.role}`, href: item.role === "guru" ? "/app/guru" : item.role === "admin" ? "/app/admin" : "/app/kelas", icon: "user" as const })),
        ...(classes.data ?? []).map((item) => ({ id: `class-${item.id}`, title: item.name, detail: "Kelas", href: "/app/kelas", icon: "class" as const })),
        ...(subjects.data ?? []).map((item) => ({ id: `subject-${item.id}`, title: item.name, detail: item.code || "Mata pelajaran", href: "/app/mata-pelajaran", icon: "subject" as const })),
        ...(exams.data ?? []).map((item) => ({ id: `exam-${item.id}`, title: item.title, detail: "Ujian", href: profile.role === "guru" ? "/app/ujian" : "/app/laporan", icon: "exam" as const })),
        ...(questions.data ?? []).map((item) => ({ id: `question-${item.id}`, title: item.body, detail: "Bank soal", href: "/app/bank-soal", icon: "question" as const })),
      ];
      setResults(next.slice(0, 12));
      setSearching(false);
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [profile.role, query]);

  const loadNotices = useCallback(async () => {
    if (!supabase) return;
    setNoticeLoading(true);
    const { data: preferences } = await supabase.from("user_notification_preferences").select("exam_updates,grading_reminders,security_alerts").eq("user_id", profile.id).maybeSingle();
    if (profile.role === "admin") {
      if (preferences && !preferences.security_alerts) {
        setNotices([]);
      } else {
        const { data } = await supabase.from("audit_logs").select("id,action,entity_type,created_at").order("created_at", { ascending: false }).limit(8);
        setNotices((data ?? []).map((item) => ({ id: `audit-${item.id}`, title: auditTitle(item.action), detail: item.entity_type ?? "Aktivitas sistem", time: new Date(item.created_at).toLocaleString("id-ID"), href: "/app/audit" })));
      }
    } else {
      const [gradingResult, examResult] = await Promise.all([
        preferences?.grading_reminders === false
          ? Promise.resolve({ data: [], error: null })
          : supabase.from("attempts").select("id,submitted_at,exams(title)").eq("status", "grading").order("submitted_at", { ascending: false }).limit(5),
        preferences?.exam_updates === false
          ? Promise.resolve({ data: [], error: null })
          : supabase.from("exams").select("id,title,starts_at,status").in("status", ["terjadwal", "berlangsung"]).order("starts_at").limit(5),
      ]);
      const gradingNotices = (gradingResult.data ?? []).map((item) => {
        const exam = Array.isArray(item.exams) ? item.exams[0] : item.exams;
        return { id: `grading-${item.id}`, title: "Jawaban menunggu koreksi", detail: exam?.title ?? "Ujian", time: item.submitted_at ? new Date(item.submitted_at).toLocaleString("id-ID") : "Baru saja", href: "/app/koreksi" };
      });
      const examNotices = (examResult.data ?? []).map((item) => ({ id: `exam-${item.id}`, title: item.status === "berlangsung" ? "Ujian sedang berlangsung" : "Ujian terjadwal", detail: item.title, time: new Date(item.starts_at).toLocaleString("id-ID"), href: "/app/ujian" }));
      setNotices([...gradingNotices, ...examNotices].slice(0, 8));
    }
    setNoticeLoading(false);
  }, [profile.id, profile.role]);

  useEffect(() => { void loadNotices(); }, [loadNotices]);

  const selectResult = (result: SearchResult) => {
    setQuery("");
    setMobileSearchOpen(false);
    navigate(result.href);
  };

  const toggleMobileSearch = () => {
    setMobileSearchOpen((open) => {
      const nextOpen = !open;
      if (nextOpen) window.requestAnimationFrame(() => searchRef.current?.focus());
      return nextOpen;
    });
    setHelpOpen(false);
    setNoticeOpen(false);
    setAccountOpen(false);
  };

  return (
    <header className="topbar">
      <button className="mobile-menu" type="button" aria-label="Buka navigasi" onClick={onOpenNavigation}><Menu /></button>
      <div className={`global-search topbar-search${mobileSearchOpen ? " mobile-open" : ""}`}>
        <Search />
        <input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={profile.role === "admin" ? "Cari pengguna, kelas, mata pelajaran, atau ujian…" : "Cari ujian, soal, atau siswa…"} />
        {query ? <button type="button" onClick={() => setQuery("")} aria-label="Bersihkan pencarian"><X /></button> : <kbd>Ctrl K</kbd>}
        {query.trim().length >= 2 && <div className="topbar-popover search-results">
          <div className="popover-title"><b>Hasil pencarian</b><span>{searching ? "Mencari…" : `${results.length} ditemukan`}</span></div>
          {!searching && !results.length ? <p className="popover-empty">Tidak ada data yang cocok.</p> : results.map((result) => <button type="button" key={result.id} onClick={() => selectResult(result)}><span>{resultIcon(result.icon)}</span><p><b>{result.title}</b><small>{result.detail}</small></p></button>)}
        </div>}
      </div>
      <div className="top-actions">
        <button type="button" className="mobile-search-toggle" aria-label={mobileSearchOpen ? "Tutup pencarian" : "Buka pencarian"} aria-expanded={mobileSearchOpen} onClick={toggleMobileSearch}>{mobileSearchOpen ? <X /> : <Search />}</button>
        <div className="top-action-wrap">
          <button type="button" aria-label="Bantuan" onClick={() => { setHelpOpen((value) => !value); setMobileSearchOpen(false); setNoticeOpen(false); setAccountOpen(false); }}><CircleHelp /></button>
          {helpOpen && <div className="topbar-popover help-popover"><div className="popover-title"><b>Pusat bantuan</b></div><p>Gunakan pencarian dengan <kbd>Ctrl K</kbd>. Semua perubahan data master tercatat pada Audit & Keamanan.</p><Link to={profile.role === "admin" ? "/app/audit" : "/app/pengaturan"} onClick={() => setHelpOpen(false)}><ShieldCheck />{profile.role === "admin" ? "Buka audit sistem" : "Buka profil akun"}</Link><Link to="/app/pengaturan" onClick={() => setHelpOpen(false)}><Settings />Buka pengaturan</Link></div>}
        </div>
        <div className="top-action-wrap">
          <button type="button" className="notification" aria-label="Notifikasi" onClick={() => { setNoticeOpen((value) => !value); setMobileSearchOpen(false); setHelpOpen(false); setAccountOpen(false); void loadNotices(); }}><Bell />{notices.length > 0 && <i />}</button>
          {noticeOpen && <div className="topbar-popover notice-popover"><div className="popover-title"><b>Notifikasi</b><button type="button" onClick={() => void loadNotices()}>Segarkan</button></div>{noticeLoading ? <p className="popover-empty">Memuat notifikasi…</p> : !notices.length ? <p className="popover-empty">Tidak ada notifikasi baru.</p> : notices.map((notice) => <Link key={notice.id} to={notice.href} onClick={() => setNoticeOpen(false)}><span><Clock3 /></span><p><b>{notice.title}</b><small>{notice.detail} · {notice.time}</small></p></Link>)}</div>}
        </div>
        <div className="top-action-wrap">
          <button type="button" className="avatar" title={profile.full_name} onClick={() => { setAccountOpen((value) => !value); setMobileSearchOpen(false); setHelpOpen(false); setNoticeOpen(false); }}>{initials(profile.full_name)}</button>
          {accountOpen && <div className="topbar-popover account-popover"><div className="account-summary"><span><GraduationCap /></span><p><b>{profile.full_name}</b><small>{profile.email}</small><em>{profile.role}</em></p></div><Link to="/app/pengaturan" onClick={() => setAccountOpen(false)}><Settings />Pengaturan akun</Link><button type="button" onClick={logout}><LogOut />Keluar</button></div>}
        </div>
      </div>
    </header>
  );
}
