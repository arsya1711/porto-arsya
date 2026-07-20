import {
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  History,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { supabase } from "../lib/supabase";

type Notify = (text: string, error?: boolean) => void;

type AcademicYear = {
  id: string;
  name: string;
  active: boolean;
};

type Subject = {
  id: string;
  name: string;
  code: string | null;
};

type AuditRow = {
  id: number;
  actor_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type IntegrityRow = {
  id: string;
  event_type: string;
  metadata: Record<string, unknown> | null;
  occurred_at: string;
  student_id: string;
  profiles: unknown;
  attempts: unknown;
};

function relatedName(value: unknown, fallback = "—") {
  if (Array.isArray(value)) return String(value[0]?.full_name ?? value[0]?.title ?? fallback);
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    return String(row.full_name ?? row.title ?? fallback);
  }
  return fallback;
}

function integrityExamName(value: unknown) {
  const attempt = Array.isArray(value) ? value[0] : value;
  if (!attempt || typeof attempt !== "object") return "—";
  return relatedName((attempt as Record<string, unknown>).exams);
}

function AdminPageTitle({
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

export function AcademicYearsPage({ notify }: { notify: Notify }) {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("academic_years")
      .select("id,name,active")
      .order("name", { ascending: false });
    if (error) notify(error.message, true);
    else setYears((data ?? []) as AcademicYear[]);
    setLoading(false);
  }, [notify]);

  useEffect(() => {
    void load();
  }, [load]);

  const createYear = async (event: FormEvent) => {
    event.preventDefault();
    const value = name.trim();
    if (!supabase || !value) return;
    setSaving(true);
    const { error } = await supabase
      .from("academic_years")
      .insert({ name: value, active: years.length === 0 });
    setSaving(false);
    if (error) notify(error.message, true);
    else {
      setName("");
      notify("Tahun ajaran berhasil ditambahkan.");
      await load();
    }
  };

  const activateYear = async (year: AcademicYear) => {
    if (!supabase || year.active) return;
    const { error } = await supabase.rpc("set_active_academic_year", {
      target_year_id: year.id,
    });
    if (error) notify(error.message, true);
    else {
      notify(`${year.name} ditetapkan sebagai tahun ajaran aktif.`);
      await load();
    }
  };

  const renameYear = async (year: AcademicYear) => {
    if (!supabase) return;
    const value = window.prompt("Nama tahun ajaran:", year.name)?.trim();
    if (!value || value === year.name) return;
    const { error } = await supabase
      .from("academic_years")
      .update({ name: value })
      .eq("id", year.id);
    if (error) notify(error.message, true);
    else {
      notify("Tahun ajaran berhasil diperbarui.");
      await load();
    }
  };

  const deleteYear = async (year: AcademicYear) => {
    if (!supabase || year.active) return;
    if (!window.confirm(`Hapus tahun ajaran ${year.name}?`)) return;
    const { error } = await supabase
      .from("academic_years")
      .delete()
      .eq("id", year.id);
    if (error) notify(error.message, true);
    else {
      notify("Tahun ajaran berhasil dihapus.");
      await load();
    }
  };

  return (
    <div className="portal-page">
      <AdminPageTitle
        eyebrow="DATA MASTER"
        title="Tahun Ajaran"
        description="Tentukan periode akademik yang digunakan oleh kelas dan laporan sekolah."
      />
      <section className="admin-master-layout">
        <form className="card admin-quick-form" onSubmit={createYear}>
          <span className="admin-card-icon blue"><CalendarDays /></span>
          <h2>Tambah tahun ajaran</h2>
          <p>Gunakan format yang konsisten, misalnya 2026/2027.</p>
          <label>
            Nama tahun ajaran
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="2027/2028"
              required
            />
          </label>
          <button className="primary" disabled={saving}>
            <Plus /> {saving ? "Menyimpan…" : "Tambahkan"}
          </button>
        </form>
        <div className="table-card admin-master-table">
          <table>
            <thead><tr><th>TAHUN AJARAN</th><th>STATUS</th><th>AKSI</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={3}>Memuat tahun ajaran…</td></tr>
              ) : years.length === 0 ? (
                <tr><td colSpan={3}>Belum ada tahun ajaran.</td></tr>
              ) : years.map((year) => (
                <tr key={year.id}>
                  <td><b className="table-main">{year.name}</b></td>
                  <td>
                    <span className={`master-status ${year.active ? "active" : ""}`}>
                      <i /> {year.active ? "Aktif" : "Tidak aktif"}
                    </span>
                  </td>
                  <td>
                    <div className="master-actions">
                      {!year.active && <button onClick={() => activateYear(year)}>Aktifkan</button>}
                      <button title="Ubah nama" onClick={() => renameYear(year)}><Pencil /></button>
                      <button
                        className="danger"
                        title={year.active ? "Tahun aktif tidak dapat dihapus" : "Hapus"}
                        disabled={year.active}
                        onClick={() => deleteYear(year)}
                      ><Trash2 /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export function SubjectsPage({ notify }: { notify: Notify }) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("subjects")
      .select("id,name,code")
      .order("name");
    if (error) notify(error.message, true);
    else setSubjects((data ?? []) as Subject[]);
    setLoading(false);
  }, [notify]);

  useEffect(() => {
    void load();
  }, [load]);

  const createSubject = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("subjects").insert({
      name: name.trim(),
      code: code.trim().toUpperCase() || null,
    });
    setSaving(false);
    if (error) notify(error.message, true);
    else {
      setName("");
      setCode("");
      notify("Mata pelajaran berhasil ditambahkan.");
      await load();
    }
  };

  const editSubject = async (subject: Subject) => {
    if (!supabase) return;
    const nextName = window.prompt("Nama mata pelajaran:", subject.name)?.trim();
    if (!nextName) return;
    const nextCode = window.prompt("Kode mata pelajaran:", subject.code ?? "")?.trim();
    if (nextCode === undefined) return;
    const { error } = await supabase
      .from("subjects")
      .update({ name: nextName, code: nextCode.toUpperCase() || null })
      .eq("id", subject.id);
    if (error) notify(error.message, true);
    else {
      notify("Mata pelajaran berhasil diperbarui.");
      await load();
    }
  };

  const deleteSubject = async (subject: Subject) => {
    if (!supabase || !window.confirm(`Hapus mata pelajaran ${subject.name}?`)) return;
    const { data, error } = await supabase.rpc("delete_subject_safely", {
      target_subject_id: subject.id,
    });
    if (error) {
      notify(error.message, true);
      return;
    }
    const result = data as {
      deleted: boolean;
      question_banks: number;
      exams: number;
      teacher_assignments: number;
    } | null;
    if (!result?.deleted) {
      const usage = [
        result?.question_banks ? `${result.question_banks} bank soal` : "",
        result?.exams ? `${result.exams} ujian` : "",
        result?.teacher_assignments ? `${result.teacher_assignments} penugasan guru` : "",
      ].filter(Boolean).join(", ");
      notify(
        `${subject.name} belum dapat dihapus karena masih dipakai oleh ${usage || "data akademik lain"}. Pindahkan atau hapus data terkait terlebih dahulu.`,
        true,
      );
    } else {
      notify("Mata pelajaran berhasil dihapus.");
      await load();
    }
  };

  return (
    <div className="portal-page">
      <AdminPageTitle
        eyebrow="DATA MASTER"
        title="Mata Pelajaran"
        description="Kelola daftar mata pelajaran yang digunakan guru, bank soal, dan ujian."
      />
      <section className="admin-master-layout">
        <form className="card admin-quick-form" onSubmit={createSubject}>
          <span className="admin-card-icon purple"><BookOpen /></span>
          <h2>Tambah mata pelajaran</h2>
          <p>Kode dipakai sebagai singkatan pada tabel dan laporan.</p>
          <label>
            Nama mata pelajaran
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Matematika" required />
          </label>
          <label>
            Kode
            <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="MTK" maxLength={12} />
          </label>
          <button className="primary" disabled={saving}>
            <Plus /> {saving ? "Menyimpan…" : "Tambahkan"}
          </button>
        </form>
        <div className="table-card admin-master-table">
          <table>
            <thead><tr><th>MATA PELAJARAN</th><th>KODE</th><th>AKSI</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={3}>Memuat mata pelajaran…</td></tr>
              ) : subjects.length === 0 ? (
                <tr><td colSpan={3}>Belum ada mata pelajaran.</td></tr>
              ) : subjects.map((subject) => (
                <tr key={subject.id}>
                  <td><b className="table-main">{subject.name}</b></td>
                  <td><span className="subject-code">{subject.code || "—"}</span></td>
                  <td>
                    <div className="master-actions">
                      <button title="Edit" onClick={() => editSubject(subject)}><Pencil /></button>
                      <button className="danger" title="Hapus" onClick={() => deleteSubject(subject)}><Trash2 /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function auditLabel(action: string) {
  const labels: Record<string, string> = {
    "user.created": "Membuat akun pengguna",
    "user.updated": "Memperbarui akun pengguna",
    "user.deleted": "Menghapus akun pengguna",
    "user.activated": "Mengaktifkan akun pengguna",
    "user.deactivated": "Menonaktifkan akun pengguna",
    "user.password_reset": "Mereset kata sandi pengguna",
    "academic_years.insert": "Menambahkan tahun ajaran",
    "academic_years.update": "Memperbarui tahun ajaran",
    "academic_years.delete": "Menghapus tahun ajaran",
    "subjects.insert": "Menambahkan mata pelajaran",
    "subjects.update": "Memperbarui mata pelajaran",
    "subjects.delete": "Menghapus mata pelajaran",
    "classes.insert": "Menambahkan kelas",
    "classes.update": "Memperbarui kelas",
    "classes.delete": "Menghapus kelas",
    "class_students.insert": "Menempatkan siswa ke kelas",
    "class_students.update": "Memperbarui keanggotaan kelas",
    "class_students.delete": "Mengeluarkan siswa dari kelas",
  };
  return labels[action] ?? action.split(".").join(" ");
}

export function AuditSecurityPage({ notify }: { notify: Notify }) {
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [actorNames, setActorNames] = useState<Record<string, string>>({});
  const [integrityEvents, setIntegrityEvents] = useState<IntegrityRow[]>([]);
  const [integrityCount, setIntegrityCount] = useState(0);
  const [activeUsers, setActiveUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const [auditResult, integrityResult, usersResult] = await Promise.all([
      supabase
        .from("audit_logs")
        .select("id,actor_id,action,entity_type,entity_id,metadata,created_at")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("integrity_events")
        .select("id,event_type,metadata,occurred_at,student_id,profiles(full_name),attempts(exams(title))", { count: "exact" })
        .order("occurred_at", { ascending: false })
        .limit(100),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("active", true),
    ]);
    const requestError = auditResult.error ?? integrityResult.error ?? usersResult.error;
    if (requestError) notify(requestError.message, true);
    if (auditResult.error) setAudits([]);
    else {
      const rows = (auditResult.data ?? []) as AuditRow[];
      setAudits(rows);
      const actorIds = [...new Set(rows.map((row) => row.actor_id).filter(Boolean))] as string[];
      if (actorIds.length) {
        const { data } = await supabase.from("profiles").select("id,full_name").in("id", actorIds);
        setActorNames(Object.fromEntries((data ?? []).map((actor) => [actor.id, actor.full_name])));
      } else setActorNames({});
    }
    setIntegrityEvents(integrityResult.error ? [] : (integrityResult.data ?? []) as unknown as IntegrityRow[]);
    setIntegrityCount(integrityResult.count ?? 0);
    setActiveUsers(usersResult.count ?? 0);
    setLoading(false);
  }, [notify]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredAudits = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return audits;
    return audits.filter((audit) =>
      [audit.action, audit.entity_type ?? "", actorNames[audit.actor_id ?? ""] ?? ""]
        .some((item) => item.toLowerCase().includes(value)),
    );
  }, [actorNames, audits, query]);

  return (
    <div className="portal-page">
      <AdminPageTitle
        eyebrow="KONTROL SISTEM"
        title="Audit & Keamanan"
        description="Tinjau tindakan sensitif dan indikator keamanan tingkat sekolah."
        action={<button className="outline" onClick={load}><RefreshCw /> Segarkan</button>}
      />
      <div className="audit-summary">
        <div className="card"><span className="admin-card-icon green"><CheckCircle2 /></span><p><small>AKUN AKTIF</small><b>{activeUsers}</b><span>pengguna dapat masuk</span></p></div>
        <div className="card"><span className="admin-card-icon amber"><ShieldCheck /></span><p><small>EVENT INTEGRITAS</small><b>{integrityCount}</b><span>tercatat di seluruh ujian</span></p></div>
        <div className="card"><span className="admin-card-icon blue"><History /></span><p><small>LOG TERBARU</small><b>{audits.length}</b><span>maksimal 100 aktivitas</span></p></div>
        <div className="card"><span className="admin-card-icon purple"><Users /></span><p><small>AKSES ADMIN</small><b>Terbatas</b><span>data master & pengawasan</span></p></div>
      </div>
      <div className="toolbar">
        <div><History /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari tindakan, aktor, atau entitas…" /></div>
      </div>
      <div className="table-card audit-table">
        <table>
          <thead><tr><th>WAKTU</th><th>AKTOR</th><th>TINDAKAN</th><th>ENTITAS</th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4}>Memuat audit log…</td></tr>
            ) : filteredAudits.length === 0 ? (
              <tr><td colSpan={4}>Belum ada aktivitas yang cocok.</td></tr>
            ) : filteredAudits.map((audit) => (
              <tr key={audit.id}>
                <td>{new Date(audit.created_at).toLocaleString("id-ID")}</td>
                <td><b className="table-main">{actorNames[audit.actor_id ?? ""] ?? "Sistem"}</b></td>
                <td>{auditLabel(audit.action)}</td>
                <td><span className="subject-code">{audit.entity_type ?? "—"}</span>{audit.entity_id ? <small>{audit.entity_id.slice(0, 8)}</small> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-card audit-table integrity-table">
        <table>
          <thead><tr><th>WAKTU</th><th>SISWA</th><th>UJIAN</th><th>EVENT</th><th>DETAIL</th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5}>Memuat event integritas…</td></tr>
            ) : integrityEvents.length === 0 ? (
              <tr><td colSpan={5}>Belum ada event integritas.</td></tr>
            ) : integrityEvents.map((event) => (
              <tr key={event.id}>
                <td>{new Date(event.occurred_at).toLocaleString("id-ID")}</td>
                <td><b className="table-main">{relatedName(event.profiles)}</b></td>
                <td>{integrityExamName(event.attempts)}</td>
                <td><span className="subject-code">{event.event_type.replace(/_/g, " ")}</span></td>
                <td><small>{event.metadata ? JSON.stringify(event.metadata) : "—"}</small></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="table-footer"><span>Menampilkan maksimal 100 event terbaru</span></div>
      </div>
    </div>
  );
}
