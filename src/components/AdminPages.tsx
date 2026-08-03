import {
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
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
  classIds: string[];
  classNames: string[];
};

type SubjectClass = {
  id: string;
  name: string;
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

type FrontendErrorRow = {
  id: string;
  reference_id: string;
  error_message: string;
  path: string;
  user_agent: string | null;
  created_at: string;
  profiles: unknown;
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
  const [showCreate, setShowCreate] = useState(false);
  const [editingYear, setEditingYear] = useState<AcademicYear | null>(null);
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

  const saveYear = async (event: FormEvent) => {
    event.preventDefault();
    const value = name.trim();
    if (!supabase || !value) return;
    if (!/^\d{4}\/\d{4}$/.test(value)) {
      notify("Gunakan format tahun ajaran YYYY/YYYY, misalnya 2026/2027.", true);
      return;
    }
    const [startYear, endYear] = value.split("/").map(Number);
    if (endYear !== startYear + 1) {
      notify("Tahun kedua harus tepat satu tahun setelah tahun pertama.", true);
      return;
    }
    setSaving(true);
    const { error } = editingYear
      ? await supabase.from("academic_years").update({ name: value }).eq("id", editingYear.id)
      : await supabase.from("academic_years").insert({ name: value, active: years.length === 0 });
    setSaving(false);
    if (error) notify(error.message, true);
    else {
      setName("");
      setShowCreate(false);
      setEditingYear(null);
      notify(editingYear ? "Tahun ajaran berhasil diperbarui." : "Tahun ajaran berhasil ditambahkan.");
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
        description="Pilih satu periode aktif untuk kelas, ujian, dan laporan sekolah."
        action={!showCreate ? (
          <button className="primary" type="button" onClick={() => { setEditingYear(null); setName(""); setShowCreate(true); }}>
            <Plus /> Tambah tahun ajaran
          </button>
        ) : undefined}
      />
      <section className={`admin-master-layout${showCreate ? "" : " list-only"}`}>
        {showCreate && <form className="card admin-quick-form" onSubmit={saveYear}>
          <span className="admin-card-icon blue"><CalendarDays /></span>
          <h2>{editingYear ? "Ubah tahun ajaran" : "Tambah tahun ajaran"}</h2>
          <p>{editingYear ? "Perubahan nama berlaku pada data yang terhubung." : "Gunakan format yang konsisten, misalnya 2026/2027."}</p>
          <label>
            Nama tahun ajaran
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="2027/2028"
              pattern="[0-9]{4}/[0-9]{4}"
              title="Gunakan format YYYY/YYYY, misalnya 2027/2028"
              required
            />
          </label>
          <div className="admin-form-actions">
            <button type="button" onClick={() => { setShowCreate(false); setEditingYear(null); setName(""); }}>
              Batal
            </button>
            <button className="primary" disabled={saving}>
              {editingYear ? <Pencil /> : <Plus />} {saving ? "Menyimpan…" : editingYear ? "Simpan perubahan" : "Tambahkan"}
            </button>
          </div>
        </form>}
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
                  <td data-label="Tahun ajaran"><b className="table-main">{year.name}</b></td>
                  <td data-label="Status">
                    <span className={`master-status ${year.active ? "active" : ""}`}>
                      <i /> {year.active ? "Aktif" : "Tidak aktif"}
                    </span>
                  </td>
                  <td data-label="Aksi">
                    <div className="master-actions">
                      {!year.active && <button onClick={() => activateYear(year)}>Aktifkan</button>}
                      <button
                        title="Ubah nama"
                        aria-label={`Ubah ${year.name}`}
                        onClick={() => { setEditingYear(year); setName(year.name); setShowCreate(true); }}
                      ><Pencil /></button>
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
  const [classes, setClasses] = useState<SubjectClass[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const [subjectResult, classResult, mappingResult] = await Promise.all([
      supabase.from("subjects").select("id,name,code").order("name"),
      supabase.from("classes").select("id,name").order("name"),
      supabase.from("class_subjects").select("class_id,subject_id"),
    ]);
    const error = subjectResult.error ?? classResult.error ?? mappingResult.error;
    if (error) notify(error.message, true);
    else {
      const loadedClasses = (classResult.data ?? []) as SubjectClass[];
      const mappings = (mappingResult.data ?? []) as {
        class_id: string;
        subject_id: string;
      }[];
      const classNameById = new Map(
        loadedClasses.map((item) => [item.id, item.name]),
      );
      setClasses(loadedClasses);
      setSubjects(
        (subjectResult.data ?? []).map((subject) => {
          const classIds = mappings
            .filter((mapping) => mapping.subject_id === subject.id)
            .map((mapping) => mapping.class_id);
          return {
            ...subject,
            classIds,
            classNames: classIds
              .map((classId) => classNameById.get(classId))
              .filter((className): className is string => Boolean(className)),
          };
        }),
      );
    }
    setLoading(false);
  }, [notify]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveSubject = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !name.trim() || !selectedClassIds.length) return;
    setSaving(true);
    const { error } = await supabase.rpc("save_subject_with_classes", {
      target_subject_id: editingSubject?.id ?? null,
      subject_name: name.trim(),
      subject_code: code.trim(),
      class_ids: selectedClassIds,
    });
    setSaving(false);
    if (error) notify(error.message, true);
    else {
      setName("");
      setCode("");
      setSelectedClassIds([]);
      setShowCreate(false);
      setEditingSubject(null);
      notify(editingSubject ? "Mata pelajaran berhasil diperbarui." : "Mata pelajaran berhasil ditambahkan.");
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
        description="Atur mata pelajaran secara manual untuk setiap tingkat atau kelas."
        action={!showCreate ? (
          <button className="primary" type="button" onClick={() => { setEditingSubject(null); setName(""); setCode(""); setSelectedClassIds([]); setShowCreate(true); }}>
            <Plus /> Tambah mata pelajaran
          </button>
        ) : undefined}
      />
      <section className={`admin-master-layout${showCreate ? "" : " list-only"}`}>
        {showCreate && <form className="card admin-quick-form" onSubmit={saveSubject}>
          <span className="admin-card-icon purple"><BookOpen /></span>
          <h2>{editingSubject ? "Ubah mata pelajaran" : "Tambah mata pelajaran"}</h2>
          <p>{editingSubject ? "Periksa nama dan kode sebelum menyimpan perubahan." : "Kode dipakai sebagai singkatan pada tabel dan laporan."}</p>
          <label>
            Nama mata pelajaran
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Matematika" required />
          </label>
          <label>
            Kode
            <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="MTK" maxLength={12} />
          </label>
          <fieldset className="subject-class-picker">
            <legend>Tersedia untuk kelas</legend>
            {!classes.length ? (
              <p>Buat kelas terlebih dahulu melalui menu Kelas &amp; Siswa.</p>
            ) : (
              <div>
                {classes.map((item) => (
                  <label key={item.id}>
                    <input
                      type="checkbox"
                      checked={selectedClassIds.includes(item.id)}
                      onChange={(event) => setSelectedClassIds((current) =>
                        event.target.checked
                          ? [...current, item.id]
                          : current.filter((classId) => classId !== item.id),
                      )}
                    />
                    <span>{item.name}</span>
                  </label>
                ))}
              </div>
            )}
            <small>Pilih minimal satu kelas. Pilihan dapat diubah selama belum dipakai oleh penugasan atau ujian.</small>
          </fieldset>
          <div className="admin-form-actions">
            <button type="button" onClick={() => { setShowCreate(false); setEditingSubject(null); setName(""); setCode(""); setSelectedClassIds([]); }}>
              Batal
            </button>
            <button className="primary" disabled={saving || !name.trim() || !selectedClassIds.length}>
              {editingSubject ? <Pencil /> : <Plus />} {saving ? "Menyimpan…" : editingSubject ? "Simpan perubahan" : "Tambahkan"}
            </button>
          </div>
        </form>}
        <div className="table-card admin-master-table">
          <table>
            <thead><tr><th>MATA PELAJARAN</th><th>KODE</th><th>TINGKAT / KELAS</th><th>AKSI</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4}>Memuat mata pelajaran…</td></tr>
              ) : subjects.length === 0 ? (
                <tr><td colSpan={4}>Belum ada mata pelajaran.</td></tr>
              ) : subjects.map((subject) => (
                <tr key={subject.id}>
                  <td data-label="Mata pelajaran"><b className="table-main">{subject.name}</b></td>
                  <td data-label="Kode"><span className="subject-code">{subject.code || "—"}</span></td>
                  <td data-label="Tingkat / kelas">
                    <div className="subject-class-list">
                      {subject.classNames.length
                        ? subject.classNames.map((className) => <span key={className}>{className}</span>)
                        : <em>Belum diatur</em>}
                    </div>
                  </td>
                  <td data-label="Aksi">
                    <div className="master-actions">
                      <button
                        title="Edit"
                        aria-label={`Edit ${subject.name}`}
                        onClick={() => { setEditingSubject(subject); setName(subject.name); setCode(subject.code ?? ""); setSelectedClassIds(subject.classIds); setShowCreate(true); }}
                      ><Pencil /></button>
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

export function AuditSecurityPage({ notify }: { notify: Notify }) {
  const [integrityEvents, setIntegrityEvents] = useState<IntegrityRow[]>([]);
  const [frontendErrors, setFrontendErrors] = useState<FrontendErrorRow[]>([]);
  const [frontendErrorCount, setFrontendErrorCount] = useState(0);
  const [integrityCount, setIntegrityCount] = useState(0);
  const [activeUsers, setActiveUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"integrity" | "errors">("errors");

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const [integrityResult, usersResult, errorResult] = await Promise.all([
      supabase
        .from("integrity_events")
        .select("id,event_type,metadata,occurred_at,student_id,profiles(full_name),attempts(exams(title))", { count: "exact" })
        .order("occurred_at", { ascending: false })
        .limit(100),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("active", true),
      supabase
        .from("frontend_error_logs")
        .select("id,reference_id,error_message,path,user_agent,created_at,profiles(full_name,email)", { count: "exact" })
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    const requestError =
      integrityResult.error ??
      usersResult.error ??
      errorResult.error;
    if (requestError) notify(requestError.message, true);
    setIntegrityEvents(integrityResult.error ? [] : (integrityResult.data ?? []) as unknown as IntegrityRow[]);
    setFrontendErrors(
      errorResult.error
        ? []
        : (errorResult.data ?? []) as unknown as FrontendErrorRow[],
    );
    setFrontendErrorCount(errorResult.count ?? 0);
    setIntegrityCount(integrityResult.count ?? 0);
    setActiveUsers(usersResult.count ?? 0);
    setLoading(false);
  }, [notify]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredIntegrityEvents = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return integrityEvents;
    return integrityEvents.filter((event) =>
      [
        event.event_type,
        relatedName(event.profiles),
        integrityExamName(event.attempts),
      ].some((item) => item.toLowerCase().includes(value)),
    );
  }, [integrityEvents, query]);
  const filteredFrontendErrors = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return frontendErrors;
    return frontendErrors.filter((item) =>
      [
        item.reference_id,
        item.error_message,
        item.path,
        relatedName(item.profiles),
      ].some((text) => text.toLowerCase().includes(value)),
    );
  }, [frontendErrors, query]);

  return (
    <div className="portal-page">
      <AdminPageTitle
        eyebrow="KONTROL SISTEM"
        title="Audit & Keamanan"
        description="Pantau log error website dan event integritas ujian. Log error disimpan maksimal 7 hari."
        action={<button className="outline" onClick={load}><RefreshCw /> Segarkan</button>}
      />
      <div className="audit-summary">
        <div className="card"><span className="admin-card-icon green"><CheckCircle2 /></span><p><small>AKUN AKTIF</small><b>{activeUsers}</b><span>pengguna dapat masuk</span></p></div>
        <div className="card"><span className="admin-card-icon amber"><ShieldCheck /></span><p><small>EVENT INTEGRITAS</small><b>{integrityCount}</b><span>tercatat di seluruh ujian</span></p></div>
        <div className="card"><span className="admin-card-icon purple"><AlertTriangle /></span><p><small>LOG ERROR WEBSITE</small><b>{frontendErrorCount}</b><span>error dalam masa retensi</span></p></div>
        <div className="card"><span className="admin-card-icon blue"><CalendarDays /></span><p><small>RETENSI LOG</small><b>7 hari</b><span>dihapus otomatis setiap hari</span></p></div>
      </div>
      <div className="section-switcher" aria-label="Jenis catatan keamanan">
        <button
          type="button"
          className={view === "errors" ? "active" : ""}
          aria-pressed={view === "errors"}
          onClick={() => { setView("errors"); setQuery(""); }}
        >
          <AlertTriangle /> Log Error Website <span>{frontendErrorCount}</span>
        </button>
        <button
          type="button"
          className={view === "integrity" ? "active" : ""}
          aria-pressed={view === "integrity"}
          onClick={() => { setView("integrity"); setQuery(""); }}
        >
          <ShieldCheck /> Integritas ujian <span>{integrityCount}</span>
        </button>
      </div>
      <div className="toolbar">
        <div>
          {view === "integrity" ? <ShieldCheck /> : <AlertTriangle />}
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={view === "integrity" ? "Cari siswa, ujian, atau event…" : "Cari referensi, pengguna, halaman, atau pesan error…"}
          />
        </div>
      </div>
      {view === "integrity" ? <div className="table-card audit-table integrity-table">
        <table>
          <thead><tr><th>WAKTU</th><th>SISWA</th><th>UJIAN</th><th>EVENT</th><th>DETAIL</th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5}>Memuat event integritas…</td></tr>
            ) : filteredIntegrityEvents.length === 0 ? (
              <tr><td colSpan={5}>Belum ada event integritas.</td></tr>
            ) : filteredIntegrityEvents.map((event) => (
              <tr key={event.id}>
                <td data-label="Waktu">{new Date(event.occurred_at).toLocaleString("id-ID")}</td>
                <td data-label="Siswa"><b className="table-main">{relatedName(event.profiles)}</b></td>
                <td data-label="Ujian">{integrityExamName(event.attempts)}</td>
                <td data-label="Event"><span className="subject-code">{event.event_type.replace(/_/g, " ")}</span></td>
                <td data-label="Detail"><small>{event.metadata ? JSON.stringify(event.metadata) : "—"}</small></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="table-footer"><span>Menampilkan maksimal 100 event terbaru</span></div>
      </div> : <div className="table-card audit-table frontend-error-table">
        <table>
          <thead><tr><th>WAKTU</th><th>REFERENSI</th><th>PENGGUNA</th><th>HALAMAN</th><th>PESAN</th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5}>Memuat log error website…</td></tr>
            ) : filteredFrontendErrors.length === 0 ? (
              <tr><td colSpan={5}>Belum ada log error website yang tercatat.</td></tr>
            ) : filteredFrontendErrors.map((item) => (
              <tr key={item.id}>
                <td data-label="Waktu">{new Date(item.created_at).toLocaleString("id-ID")}</td>
                <td data-label="Referensi"><code>{item.reference_id.slice(0, 8)}</code></td>
                <td data-label="Pengguna"><b className="table-main">{relatedName(item.profiles)}</b></td>
                <td data-label="Halaman"><code>{item.path}</code></td>
                <td data-label="Pesan"><span title={item.error_message}>{item.error_message}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="table-footer"><span>Gunakan ID referensi untuk penelusuran. Log yang berusia lebih dari 7 hari dihapus otomatis.</span></div>
      </div>}
    </div>
  );
}
