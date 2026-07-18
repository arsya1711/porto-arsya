import { useCallback, useEffect, useState, type ChangeEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  GraduationCap,
  ImagePlus,
  LoaderCircle,
  LockKeyhole,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { Profile } from "../auth/AuthContext";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

type Notify = (text: string, error?: boolean) => void;
type Settings = {
  school_name: string;
  npsn: string;
  address: string;
  logo_url: string;
  require_fullscreen_default: boolean;
  record_tab_switches: boolean;
  session_timeout_minutes: number;
  passing_score: number;
};
type Preferences = {
  exam_updates: boolean;
  grading_reminders: boolean;
  security_alerts: boolean;
  email_notifications: boolean;
};
type Tab = "profile" | "security" | "academic" | "notifications";

const EMPTY_SETTINGS: Settings = {
  school_name: "",
  npsn: "",
  address: "",
  logo_url: "",
  require_fullscreen_default: true,
  record_tab_switches: true,
  session_timeout_minutes: 120,
  passing_score: 75,
};
const DEFAULT_PREFERENCES: Preferences = {
  exam_updates: true,
  grading_reminders: true,
  security_alerts: true,
  email_notifications: false,
};

export function RealSettingsPage({ profile, notify }: { profile: Profile; notify: Notify }) {
  const [tab, setTab] = useState<Tab>("profile");
  const [settings, setSettings] = useState<Settings>(EMPTY_SETTINGS);
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [activeYear, setActiveYear] = useState("Belum ditentukan");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    setLoading(true);
    const [settingsResult, preferenceResult, yearResult] = await Promise.all([
      supabase.from("school_profile_settings").select("school_name,npsn,address,logo_url,require_fullscreen_default,record_tab_switches,session_timeout_minutes,passing_score").eq("id", 1).maybeSingle(),
      supabase.from("user_notification_preferences").select("exam_updates,grading_reminders,security_alerts,email_notifications").eq("user_id", profile.id).maybeSingle(),
      supabase.from("academic_years").select("name").eq("active", true).maybeSingle(),
    ]);
    if (settingsResult.data) setSettings({
      school_name: settingsResult.data.school_name ?? "",
      npsn: settingsResult.data.npsn ?? "",
      address: settingsResult.data.address ?? "",
      logo_url: settingsResult.data.logo_url ?? "",
      require_fullscreen_default: settingsResult.data.require_fullscreen_default ?? true,
      record_tab_switches: settingsResult.data.record_tab_switches ?? true,
      session_timeout_minutes: settingsResult.data.session_timeout_minutes ?? 120,
      passing_score: Number(settingsResult.data.passing_score ?? 75),
    });
    if (preferenceResult.data) setPreferences(preferenceResult.data as Preferences);
    if (yearResult.data) setActiveYear(yearResult.data.name);
    const error = settingsResult.error ?? preferenceResult.error ?? yearResult.error;
    if (error) notify(error.message, true);
    setLoading(false);
  }, [notify, profile.id]);

  useEffect(() => { void load(); }, [load]);

  const saveSchoolSettings = async (nextSettings = settings) => {
    if (!supabase || profile.role !== "admin" || !nextSettings.school_name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("school_profile_settings").upsert({
      id: 1,
      school_name: nextSettings.school_name.trim(),
      npsn: nextSettings.npsn.trim() || null,
      address: nextSettings.address.trim() || null,
      logo_url: nextSettings.logo_url || null,
      require_fullscreen_default: nextSettings.require_fullscreen_default,
      record_tab_switches: nextSettings.record_tab_switches,
      session_timeout_minutes: nextSettings.session_timeout_minutes,
      passing_score: nextSettings.passing_score,
      updated_by: profile.id,
    });
    setSaving(false);
    if (error) notify(error.message, true);
    else {
      notify("Pengaturan sekolah berhasil diperbarui.");
      window.dispatchEvent(new Event("school-settings-updated"));
    }
  };

  const savePreferences = async () => {
    if (!supabase) return;
    setSaving(true);
    const { error } = await supabase.from("user_notification_preferences").upsert({ user_id: profile.id, ...preferences }, { onConflict: "user_id" });
    setSaving(false);
    if (error) notify(error.message, true);
    else notify("Preferensi notifikasi berhasil disimpan.");
  };

  const uploadLogo = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !supabase) return;
    if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) {
      notify("Logo harus berupa gambar dengan ukuran maksimal 2 MB.", true);
      return;
    }
    setUploading(true);
    const extension = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `school-logo.${extension}`;
    const { error: uploadError } = await supabase.storage.from("school-assets").upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
    if (uploadError) {
      setUploading(false);
      notify(uploadError.message, true);
      return;
    }
    const { data } = supabase.storage.from("school-assets").getPublicUrl(path);
    const next = { ...settings, logo_url: `${data.publicUrl}?v=${Date.now()}` };
    setSettings(next);
    setUploading(false);
    await saveSchoolSettings(next);
  };

  const availableTabs: { id: Tab; label: string; icon: ReactNode }[] = profile.role === "admin"
    ? [
        { id: "profile", label: "Profil sekolah", icon: <UserRound /> },
        { id: "security", label: "Keamanan", icon: <LockKeyhole /> },
        { id: "academic", label: "Tahun ajaran", icon: <CalendarDays /> },
        { id: "notifications", label: "Notifikasi", icon: <Bell /> },
      ]
    : [
        { id: "profile", label: "Profil akun", icon: <UserRound /> },
        { id: "notifications", label: "Notifikasi", icon: <Bell /> },
      ];

  return (
    <div className="portal-page">
      <div className="page-title"><div><p>PENGATURAN</p><h1>Pengaturan Aplikasi</h1><span>Kelola identitas, keamanan, periode akademik, dan notifikasi.</span></div></div>
      <div className="settings-functional-layout">
        <aside>{availableTabs.map((item) => <button type="button" key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}>{item.icon}{item.label}</button>)}</aside>
        <div>
          {loading ? <div className="card settings-loading"><LoaderCircle className="spin" /> Memuat pengaturan…</div> : <>
            {tab === "profile" && <section className="card settings-form">
              <h2>{profile.role === "admin" ? "Profil sekolah" : "Informasi akun"}</h2>
              <p>{profile.role === "admin" ? "Identitas ini tampil pada sidebar dan laporan sekolah." : "Data identitas berasal dari profil Supabase Auth."}</p>
              <div className="school-logo">
                <span>{settings.logo_url ? <img src={settings.logo_url} alt="Logo sekolah" /> : <GraduationCap />}</span>
                <div><b>{profile.role === "admin" ? settings.school_name || "Nama sekolah" : profile.full_name}</b><small>{profile.email}</small></div>
                {profile.role === "admin" && <label className="logo-upload"><ImagePlus />{uploading ? "Mengunggah…" : "Ganti logo"}<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" disabled={uploading} onChange={(event) => void uploadLogo(event)} /></label>}
              </div>
              {profile.role === "admin" ? <>
                <div className="form-grid"><label className="form-field"><span>Nama sekolah</span><input value={settings.school_name} onChange={(event) => setSettings({ ...settings, school_name: event.target.value })} /></label><label className="form-field"><span>NPSN</span><input value={settings.npsn} onChange={(event) => setSettings({ ...settings, npsn: event.target.value })} /></label></div>
                <label className="form-field"><span>Alamat</span><textarea rows={3} value={settings.address} onChange={(event) => setSettings({ ...settings, address: event.target.value })} /></label>
                <div className="settings-save"><button type="button" className="primary" disabled={saving || !settings.school_name.trim()} onClick={() => void saveSchoolSettings()}><Save />{saving ? "Menyimpan…" : "Simpan profil"}</button></div>
              </> : <><div className="form-grid"><label className="form-field"><span>Nama lengkap</span><input value={profile.full_name} readOnly /></label><label className="form-field"><span>Email</span><input value={profile.email} readOnly /></label></div><div className="settings-save"><CheckCircle2 /><span>Supabase {isSupabaseConfigured ? "terhubung" : "belum dikonfigurasi"} · Hak akses {profile.role}</span></div></>}
            </section>}
            {tab === "security" && profile.role === "admin" && <section className="card settings-form">
              <h2>Keamanan ujian dan sesi</h2><p>Nilai berikut menjadi default untuk ujian baru dan sesi portal.</p>
              <div className="settings-toggle-list">
                <label><span><b>Mode layar penuh</b><small>Aktifkan sebagai default pada ujian baru.</small></span><input type="checkbox" checked={settings.require_fullscreen_default} onChange={(event) => setSettings({ ...settings, require_fullscreen_default: event.target.checked })} /></label>
                <label><span><b>Catat perpindahan tab</b><small>Simpan event integritas ketika siswa keluar dari layar ujian.</small></span><input type="checkbox" checked={settings.record_tab_switches} onChange={(event) => setSettings({ ...settings, record_tab_switches: event.target.checked })} /></label>
              </div>
              <label className="form-field"><span>Batas sesi tidak aktif</span><select value={settings.session_timeout_minutes} onChange={(event) => setSettings({ ...settings, session_timeout_minutes: Number(event.target.value) })}><option value={30}>30 menit</option><option value={60}>1 jam</option><option value={120}>2 jam</option><option value={240}>4 jam</option><option value={480}>8 jam</option></select></label>
              <div className="security-note"><ShieldCheck /><p><b>Row Level Security aktif</b><span>Hak akses tetap dibatasi oleh role pada database Supabase.</span></p></div>
              <div className="settings-save"><button type="button" className="primary" disabled={saving} onClick={() => void saveSchoolSettings()}><Save />{saving ? "Menyimpan…" : "Simpan keamanan"}</button></div>
            </section>}
            {tab === "academic" && profile.role === "admin" && <section className="card settings-form">
              <h2>Tahun ajaran</h2><p>Periode aktif digunakan ketika Admin membuat kelas baru.</p>
              <div className="academic-setting-card"><span><CalendarDays /></span><div><small>TAHUN AJARAN AKTIF</small><b>{activeYear}</b></div><Link to="/app/tahun-ajaran">Kelola tahun ajaran</Link></div>
              <label className="form-field"><span>KKM / nilai ketuntasan</span><input type="number" min={0} max={100} step={1} value={settings.passing_score} onChange={(event) => setSettings({ ...settings, passing_score: Number(event.target.value) })} /></label>
              <div className="settings-save"><button type="button" className="primary" disabled={saving || settings.passing_score < 0 || settings.passing_score > 100} onClick={() => void saveSchoolSettings()}><Save />{saving ? "Menyimpan…" : "Simpan pengaturan akademik"}</button></div>
            </section>}
            {tab === "notifications" && <section className="card settings-form">
              <h2>Preferensi notifikasi</h2><p>Atur informasi yang muncul pada pusat notifikasi di header.</p>
              <div className="settings-toggle-list">
                <label><span><b>Pembaruan ujian</b><small>Jadwal dan perubahan status ujian.</small></span><input type="checkbox" checked={preferences.exam_updates} onChange={(event) => setPreferences({ ...preferences, exam_updates: event.target.checked })} /></label>
                <label><span><b>Pengingat koreksi</b><small>Jawaban essay yang masih menunggu nilai.</small></span><input type="checkbox" checked={preferences.grading_reminders} onChange={(event) => setPreferences({ ...preferences, grading_reminders: event.target.checked })} /></label>
                <label><span><b>Peringatan keamanan</b><small>Aktivitas penting dan event integritas.</small></span><input type="checkbox" checked={preferences.security_alerts} onChange={(event) => setPreferences({ ...preferences, security_alerts: event.target.checked })} /></label>
              </div>
              <div className="settings-save"><button type="button" className="primary" disabled={saving} onClick={() => void savePreferences()}><Save />{saving ? "Menyimpan…" : "Simpan notifikasi"}</button></div>
            </section>}
          </>}
        </div>
      </div>
    </div>
  );
}
