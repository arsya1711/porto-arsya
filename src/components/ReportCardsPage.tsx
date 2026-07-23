import {
  type Dispatch,
  type FormEvent,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  BookOpenCheck,
  CheckCircle2,
  Download,
  FilePenLine,
  GraduationCap,
  LockKeyhole,
  Printer,
  RefreshCw,
  Save,
  Settings2,
  UnlockKeyhole,
  X,
} from "lucide-react";
import type { Profile } from "../auth/auth-context";
import { supabase } from "../lib/supabase";

type Notify = (text: string, error?: boolean) => void;

type Period = {
  id: string;
  name: string;
  semester: number;
  starts_on: string;
  ends_on: string;
  academic_year_id: string;
  academicYear: string;
  activeYear: boolean;
};

type ClassOption = {
  id: string;
  name: string;
  academic_year_id: string | null;
  academicYear: string;
  homeroom_teacher_id: string | null;
  studentCount: number;
};

type Student = {
  id: string;
  name: string;
  studentNumber: string;
};

type ReportRow = {
  student_id: string;
  student_name: string;
  student_number: string;
  subject_id: string;
  subject_name: string;
  subject_code: string;
  automatic_score: number | null;
  final_score: number | null;
  predicate: string;
  description: string;
  exam_count: number;
  manually_adjusted: boolean;
};

type Note = {
  period_id: string;
  class_id: string;
  student_id: string;
  homeroom_note: string | null;
  extracurricular: string | null;
  sick_days: number;
  permitted_days: number;
  absent_days: number;
};

type ExamComponent = {
  id: string;
  title: string;
  subjectName: string;
  startsAt: string;
  included: boolean;
  weight: number;
};

type School = {
  name: string;
  npsn: string;
  address: string;
  logoUrl: string;
};

function record(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) return (value[0] ?? {}) as Record<string, unknown>;
  return (value ?? {}) as Record<string, unknown>;
}

function countRelation(value: unknown) {
  return Array.isArray(value) ? Number(value[0]?.count ?? 0) : 0;
}

function scoreText(value: number | null) {
  return value === null
    ? "—"
    : value.toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function ReportCardsPage({
  profile,
  notify,
}: {
  profile: Profile;
  notify: Notify;
}) {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [components, setComponents] = useState<ExamComponent[]>([]);
  const [school, setSchool] = useState<School>({
    name: "Mts Alhidayah Wattaqwa",
    npsn: "",
    address: "",
    logoUrl: "",
  });
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [view, setView] = useState<"rapor" | "leger">("rapor");
  const [loading, setLoading] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState("");
  const [published, setPublished] = useState(false);
  const [gradeEditor, setGradeEditor] = useState<ReportRow | null>(null);
  const [showComponents, setShowComponents] = useState(false);

  const loadOptions = useCallback(async () => {
    if (!supabase) {
      setError("Supabase belum dikonfigurasi.");
      setLoading(false);
      return;
    }
    setLoading(true);
    const [periodResult, classResult, schoolResult] = await Promise.all([
      supabase
        .from("report_periods")
        .select(
          "id,name,semester,starts_on,ends_on,academic_year_id,academic_years(name,active)",
        )
        .order("starts_on", { ascending: false }),
      supabase
        .from("classes")
        .select(
          "id,name,academic_year_id,homeroom_teacher_id,academic_years(name),class_students(count)",
        )
        .order("name"),
      supabase
        .from("school_profile_settings")
        .select("school_name,npsn,address,logo_url")
        .eq("id", 1)
        .maybeSingle(),
    ]);
    const loadError =
      periodResult.error ?? classResult.error ?? schoolResult.error;
    if (loadError) {
      setError(loadError.message);
      setLoading(false);
      return;
    }

    const normalizedPeriods: Period[] = (periodResult.data ?? []).map((item) => {
      const year = record(item.academic_years);
      return {
        id: item.id,
        name: item.name,
        semester: Number(item.semester),
        starts_on: item.starts_on,
        ends_on: item.ends_on,
        academic_year_id: item.academic_year_id,
        academicYear: String(year.name ?? "—"),
        activeYear: Boolean(year.active),
      };
    });
    const normalizedClasses: ClassOption[] = (classResult.data ?? []).map(
      (item) => ({
        id: item.id,
        name: item.name,
        academic_year_id: item.academic_year_id,
        academicYear: String(record(item.academic_years).name ?? "Belum diatur"),
        homeroom_teacher_id: item.homeroom_teacher_id,
        studentCount: countRelation(item.class_students),
      }),
    );
    setPeriods(normalizedPeriods);
    setClasses(normalizedClasses);
    const today = localDateKey();
    setSelectedPeriod(
      (current) =>
        current ||
        normalizedPeriods.find(
          (period) =>
            period.starts_on <= today && period.ends_on >= today,
        )?.id ||
        normalizedPeriods.find((period) => period.activeYear)?.id ||
        normalizedPeriods[0]?.id ||
        "",
    );
    setSelectedClass(
      (current) =>
        current ||
        normalizedClasses.find((item) => item.studentCount > 0)?.id ||
        normalizedClasses[0]?.id ||
        "",
    );
    if (schoolResult.data) {
      setSchool({
        name: schoolResult.data.school_name || "Mts Alhidayah Wattaqwa",
        npsn: schoolResult.data.npsn || "",
        address: schoolResult.data.address || "",
        logoUrl: schoolResult.data.logo_url || "",
      });
    }
    setError("");
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  const loadReport = useCallback(async () => {
    if (!supabase || !selectedPeriod || !selectedClass) return;
    setLoadingReport(true);
    const period = periods.find((item) => item.id === selectedPeriod);
    const [studentResult, reportResult, noteResult, publicationResult, examResult, weightResult] =
      await Promise.all([
        supabase
          .from("class_students")
          .select("student_id,profiles(id,full_name,student_number)")
          .eq("class_id", selectedClass),
        supabase.rpc("get_report_card_data", {
          target_period_id: selectedPeriod,
          target_class_id: selectedClass,
        }),
        supabase
          .from("report_student_notes")
          .select(
            "period_id,class_id,student_id,homeroom_note,extracurricular,sick_days,permitted_days,absent_days",
          )
          .eq("period_id", selectedPeriod)
          .eq("class_id", selectedClass),
        supabase
          .from("report_publications")
          .select("published")
          .eq("period_id", selectedPeriod)
          .eq("class_id", selectedClass)
          .maybeSingle(),
        period
          ? supabase
              .from("exams")
              .select("id,title,starts_at,subjects(name)")
              .eq("class_id", selectedClass)
              .gte("starts_at", `${period.starts_on}T00:00:00`)
              .lte("starts_at", `${period.ends_on}T23:59:59`)
              .order("starts_at")
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from("report_exam_weights")
          .select("exam_id,weight,included")
          .eq("period_id", selectedPeriod),
      ]);

    const loadError =
      studentResult.error ??
      reportResult.error ??
      noteResult.error ??
      publicationResult.error ??
      examResult.error ??
      weightResult.error;
    if (loadError) {
      setError(loadError.message);
      setLoadingReport(false);
      return;
    }

    const normalizedStudents = (studentResult.data ?? [])
      .map((item) => {
        const student = record(item.profiles);
        return {
          id: String(student.id ?? item.student_id),
          name: String(student.full_name ?? "Siswa"),
          studentNumber: String(student.student_number ?? ""),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "id"));
    const weights = new Map(
      (weightResult.data ?? []).map((item) => [item.exam_id, item]),
    );
    setStudents(normalizedStudents);
    setRows(
      (reportResult.data ?? []).map((item: Record<string, unknown>) => ({
        ...item,
        automatic_score:
          item.automatic_score === null ? null : Number(item.automatic_score),
        final_score: item.final_score === null ? null : Number(item.final_score),
        exam_count: Number(item.exam_count),
      })) as ReportRow[],
    );
    setNotes((noteResult.data ?? []) as Note[]);
    setPublished(Boolean(publicationResult.data?.published));
    setComponents(
      (examResult.data ?? []).map((item) => {
        const weight = weights.get(item.id);
        return {
          id: item.id,
          title: item.title,
          subjectName: String(record(item.subjects).name ?? "Mata pelajaran"),
          startsAt: item.starts_at,
          included: weight?.included ?? true,
          weight: Number(weight?.weight ?? 1),
        };
      }),
    );
    setSelectedStudent((current) =>
      normalizedStudents.some((student) => student.id === current)
        ? current
        : normalizedStudents[0]?.id ?? "",
    );
    setError("");
    setLoadingReport(false);
  }, [periods, selectedClass, selectedPeriod]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const selectedPeriodData = periods.find(
    (period) => period.id === selectedPeriod,
  );
  const selectedClassData = classes.find(
    (item) => item.id === selectedClass,
  );
  const selectedStudentData = students.find(
    (student) => student.id === selectedStudent,
  );
  const selectedRows = rows.filter((row) => row.student_id === selectedStudent);
  const selectedNote = notes.find((note) => note.student_id === selectedStudent);
  const completedScores = selectedRows.flatMap((row) =>
    row.final_score === null ? [] : [row.final_score],
  );
  const average = completedScores.length
    ? completedScores.reduce((sum, score) => sum + score, 0) /
      completedScores.length
    : null;
  const canManageNotes =
    profile.role === "admin" ||
    selectedClassData?.homeroom_teacher_id === profile.id;

  const saveWeights = async () => {
    if (!supabase || !selectedPeriod) return;
    const { error: saveError } = await supabase
      .from("report_exam_weights")
      .upsert(
        components.map((component) => ({
          period_id: selectedPeriod,
          exam_id: component.id,
          weight: component.weight,
          included: component.included,
          updated_by: profile.id,
        })),
        { onConflict: "period_id,exam_id" },
      );
    if (saveError) {
      notify(saveError.message, true);
      return;
    }
    notify("Komponen dan bobot rapor berhasil disimpan.");
    setShowComponents(false);
    await loadReport();
  };

  const togglePublication = async () => {
    if (!supabase || !selectedPeriod || !selectedClass) return;
    const nextPublished = !published;
    const { error: saveError } = await supabase
      .from("report_publications")
      .upsert(
        {
          period_id: selectedPeriod,
          class_id: selectedClass,
          published: nextPublished,
          published_at: nextPublished ? new Date().toISOString() : null,
          published_by: nextPublished ? profile.id : null,
        },
        { onConflict: "period_id,class_id" },
      );
    if (saveError) {
      notify(saveError.message, true);
      return;
    }
    setPublished(nextPublished);
    notify(nextPublished ? "Rapor berhasil dipublikasikan." : "Publikasi rapor dibatalkan.");
  };

  const printReport = () => {
    if (!selectedStudentData) {
      notify("Pilih siswa yang akan dicetak.", true);
      return;
    }
    window.print();
  };

  const exportLedger = () => {
    const subjects = [
      ...new Map(rows.map((row) => [row.subject_id, row.subject_name])).entries(),
    ];
    const header = [
      "NIS",
      "Nama siswa",
      ...subjects.map(([, name]) => name),
      "Rata-rata",
    ];
    const body = students.map((student) => {
      const studentRows = rows.filter((row) => row.student_id === student.id);
      const scores = studentRows.flatMap((row) =>
        row.final_score === null ? [] : [row.final_score],
      );
      return [
        student.studentNumber,
        student.name,
        ...subjects.map(
          ([id]) =>
            studentRows.find((row) => row.subject_id === id)?.final_score ?? "",
        ),
        scores.length
          ? (
              scores.reduce((sum, score) => sum + score, 0) / scores.length
            ).toFixed(2)
          : "",
      ];
    });
    const csv = [header, ...body]
      .map((columns) =>
        columns
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(
      new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `leger-${selectedClassData?.name ?? "kelas"}-${selectedPeriodData?.name ?? "semester"}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="portal-page report-cards-page">
      <div className="page-title report-page-title">
        <div>
          <p>AKADEMIK</p>
          <h1>Rapor Semester</h1>
          <span>
            Rekap nilai final, catatan wali kelas, absensi, dan publikasi rapor.
          </span>
        </div>
        <div className="title-actions report-title-actions">
          <button onClick={() => void loadReport()}>
            <RefreshCw /> Perbarui
          </button>
          <button className="primary" onClick={printReport}>
            <Printer /> Cetak / PDF
          </button>
        </div>
      </div>

      <div className="report-card-filters">
        <label>
          <span>Periode</span>
          <select
            value={selectedPeriod}
            onChange={(event) => setSelectedPeriod(event.target.value)}
          >
            {periods.map((period) => (
              <option value={period.id} key={period.id}>
                {period.name} · {period.academicYear}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Kelas</span>
          <select
            value={selectedClass}
            onChange={(event) => setSelectedClass(event.target.value)}
          >
            {classes.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name} · {item.studentCount} siswa
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Siswa</span>
          <select
            value={selectedStudent}
            onChange={(event) => setSelectedStudent(event.target.value)}
            disabled={!students.length}
          >
            {students.map((student) => (
              <option value={student.id} key={student.id}>
                {student.name}
                {student.studentNumber ? ` · ${student.studentNumber}` : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedClassData && !selectedClassData.academic_year_id && (
        <div className="report-warning">
          <LockKeyhole />
          Kelas {selectedClassData.name} belum ditautkan ke tahun ajaran. Nilai
          masih dapat dilihat, tetapi sebaiknya Admin melengkapinya di menu
          Kelas & Siswa.
        </div>
      )}

      <div className="report-card-toolbar">
        <div className="report-view-tabs">
          <button
            className={view === "rapor" ? "active" : ""}
            onClick={() => setView("rapor")}
          >
            <BookOpenCheck /> Rapor siswa
          </button>
          <button
            className={view === "leger" ? "active" : ""}
            onClick={() => setView("leger")}
          >
            <GraduationCap /> Leger kelas
          </button>
        </div>
        <div>
          <button onClick={() => setShowComponents(true)}>
            <Settings2 /> Komponen nilai
          </button>
          {canManageNotes && (
            <button
              className={published ? "published" : ""}
              onClick={() => void togglePublication()}
            >
              {published ? <CheckCircle2 /> : <UnlockKeyhole />}
              {published ? "Sudah dipublikasikan" : "Publikasikan rapor"}
            </button>
          )}
        </div>
      </div>

      {loading || loadingReport ? (
        <div className="report-card-state">Memuat data rapor…</div>
      ) : error ? (
        <div className="report-card-state error">
          <b>Rapor belum dapat dimuat</b>
          <span>{error}</span>
          <button onClick={() => void loadOptions()}>Coba lagi</button>
        </div>
      ) : !students.length ? (
        <div className="report-card-state">
          Belum ada siswa yang ditempatkan pada kelas ini.
        </div>
      ) : view === "rapor" ? (
        <ReportSheet
          school={school}
          period={selectedPeriodData}
          classId={selectedClass}
          className={selectedClassData?.name ?? "—"}
          student={selectedStudentData}
          rows={selectedRows}
          note={selectedNote}
          average={average}
          published={published}
          canManageNotes={canManageNotes}
          profile={profile}
          notify={notify}
          onEditGrade={setGradeEditor}
          onSaved={() => void loadReport()}
        />
      ) : (
        <Ledger
          students={students}
          rows={rows}
          onEditGrade={setGradeEditor}
          onExport={exportLedger}
        />
      )}

      {gradeEditor && (
        <GradeEditor
          row={gradeEditor}
          periodId={selectedPeriod}
          classId={selectedClass}
          profile={profile}
          close={() => setGradeEditor(null)}
          notify={notify}
          saved={async () => {
            setGradeEditor(null);
            await loadReport();
          }}
        />
      )}

      {showComponents && (
        <ComponentEditor
          components={components}
          setComponents={setComponents}
          close={() => setShowComponents(false)}
          save={() => void saveWeights()}
        />
      )}
    </div>
  );
}

function ReportSheet({
  school,
  period,
  classId,
  className,
  student,
  rows,
  note,
  average,
  published,
  canManageNotes,
  profile,
  notify,
  onEditGrade,
  onSaved,
}: {
  school: School;
  period?: Period;
  classId: string;
  className: string;
  student?: Student;
  rows: ReportRow[];
  note?: Note;
  average: number | null;
  published: boolean;
  canManageNotes: boolean;
  profile: Profile;
  notify: Notify;
  onEditGrade: (row: ReportRow) => void;
  onSaved: () => void;
}) {
  const [homeroomNote, setHomeroomNote] = useState("");
  const [extracurricular, setExtracurricular] = useState("");
  const [sickDays, setSickDays] = useState(0);
  const [permittedDays, setPermittedDays] = useState(0);
  const [absentDays, setAbsentDays] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setHomeroomNote(note?.homeroom_note ?? "");
    setExtracurricular(note?.extracurricular ?? "");
    setSickDays(note?.sick_days ?? 0);
    setPermittedDays(note?.permitted_days ?? 0);
    setAbsentDays(note?.absent_days ?? 0);
  }, [note, student?.id]);

  const saveNote = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !period || !student) return;
    setSaving(true);
    const { error } = await supabase.from("report_student_notes").upsert(
      {
        period_id: period.id,
        class_id: classId,
        student_id: student.id,
        homeroom_note: homeroomNote.trim() || null,
        extracurricular: extracurricular.trim() || null,
        sick_days: sickDays,
        permitted_days: permittedDays,
        absent_days: absentDays,
        updated_by: profile.id,
      },
      { onConflict: "period_id,class_id,student_id" },
    );
    setSaving(false);
    if (error) {
      notify(error.message, true);
      return;
    }
    notify("Catatan dan kehadiran siswa berhasil disimpan.");
    onSaved();
  };

  return (
    <article className="report-sheet">
      <header className="report-school-header">
        {school.logoUrl ? (
          <img src={school.logoUrl} alt="Logo sekolah" />
        ) : (
          <span>
            <GraduationCap />
          </span>
        )}
        <div>
          <small>LAPORAN HASIL BELAJAR</small>
          <h2>{school.name}</h2>
          <p>
            {school.address || "Alamat sekolah belum diatur"}
            {school.npsn ? ` · NPSN ${school.npsn}` : ""}
          </p>
        </div>
        <em className={published ? "published" : ""}>
          {published ? "DIPUBLIKASIKAN" : "DRAF"}
        </em>
      </header>

      <div className="report-student-identity">
        <dl>
          <div>
            <dt>Nama siswa</dt>
            <dd>{student?.name ?? "—"}</dd>
          </div>
          <div>
            <dt>NIS</dt>
            <dd>{student?.studentNumber || "—"}</dd>
          </div>
        </dl>
        <dl>
          <div>
            <dt>Kelas</dt>
            <dd>{className}</dd>
          </div>
          <div>
            <dt>Semester</dt>
            <dd>
              {period?.name ?? "—"} · {period?.academicYear ?? "—"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="report-grade-table-wrap">
        <table className="report-grade-table">
          <thead>
            <tr>
              <th>No.</th>
              <th>Mata pelajaran</th>
              <th>Nilai</th>
              <th>Predikat</th>
              <th>Capaian kompetensi</th>
              <th className="report-screen-only">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row, index) => (
                <tr key={row.subject_id}>
                  <td>{index + 1}</td>
                  <td>
                    <b>{row.subject_name}</b>
                    <small>
                      {row.subject_code || "—"} · {row.exam_count} ujian
                    </small>
                  </td>
                  <td>
                    <b>{scoreText(row.final_score)}</b>
                    {row.manually_adjusted && <small>Disesuaikan</small>}
                  </td>
                  <td>
                    <span className={`report-predicate grade-${row.predicate}`}>
                      {row.predicate}
                    </span>
                  </td>
                  <td>{row.description}</td>
                  <td className="report-screen-only">
                    <button onClick={() => onEditGrade(row)}>
                      <FilePenLine /> Ubah
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6}>Belum ada mata pelajaran atau ujian pada periode ini.</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>Rata-rata nilai</td>
              <td>{scoreText(average)}</td>
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>
      </div>

      <form className="report-notes" onSubmit={saveNote}>
        <div>
          <label>
            <span>Catatan wali kelas</span>
            <textarea
              rows={3}
              value={homeroomNote}
              onChange={(event) => setHomeroomNote(event.target.value)}
              placeholder="Perkembangan, kekuatan, dan hal yang perlu ditingkatkan…"
              disabled={!canManageNotes}
            />
          </label>
          <label>
            <span>Ekstrakurikuler / prestasi</span>
            <textarea
              rows={3}
              value={extracurricular}
              onChange={(event) => setExtracurricular(event.target.value)}
              placeholder="Kegiatan dan prestasi siswa…"
              disabled={!canManageNotes}
            />
          </label>
        </div>
        <fieldset disabled={!canManageNotes}>
          <legend>Ketidakhadiran</legend>
          <label>
            <span>Sakit</span>
            <input
              type="number"
              min={0}
              value={sickDays}
              onChange={(event) => setSickDays(Number(event.target.value))}
            />
          </label>
          <label>
            <span>Izin</span>
            <input
              type="number"
              min={0}
              value={permittedDays}
              onChange={(event) => setPermittedDays(Number(event.target.value))}
            />
          </label>
          <label>
            <span>Tanpa keterangan</span>
            <input
              type="number"
              min={0}
              value={absentDays}
              onChange={(event) => setAbsentDays(Number(event.target.value))}
            />
          </label>
        </fieldset>
        {canManageNotes && (
          <button className="report-note-save" disabled={saving}>
            <Save /> {saving ? "Menyimpan…" : "Simpan catatan"}
          </button>
        )}
      </form>

      <footer className="report-print-footer">
        <div>
          <span>Orang tua/wali</span>
          <b>________________________</b>
        </div>
        <div>
          <span>Wali kelas</span>
          <b>________________________</b>
        </div>
      </footer>
    </article>
  );
}

function Ledger({
  students,
  rows,
  onEditGrade,
  onExport,
}: {
  students: Student[];
  rows: ReportRow[];
  onEditGrade: (row: ReportRow) => void;
  onExport: () => void;
}) {
  const subjects = useMemo(
    () =>
      [
        ...new Map(
          rows.map((row) => [
            row.subject_id,
            { id: row.subject_id, name: row.subject_name },
          ]),
        ).values(),
      ],
    [rows],
  );

  return (
    <section className="ledger-card">
      <header>
        <div>
          <h2>Leger Nilai Kelas</h2>
          <span>Klik nilai untuk melakukan penyesuaian yang tercatat.</span>
        </div>
        <button onClick={onExport}>
          <Download /> Ekspor CSV
        </button>
      </header>
      <div>
        <table>
          <thead>
            <tr>
              <th>NIS</th>
              <th>Nama siswa</th>
              {subjects.map((subject) => (
                <th key={subject.id}>{subject.name}</th>
              ))}
              <th>Rata-rata</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => {
              const studentRows = rows.filter(
                (row) => row.student_id === student.id,
              );
              const scores = studentRows.flatMap((row) =>
                row.final_score === null ? [] : [row.final_score],
              );
              const average = scores.length
                ? scores.reduce((sum, score) => sum + score, 0) / scores.length
                : null;
              return (
                <tr key={student.id}>
                  <td>{student.studentNumber || "—"}</td>
                  <td>
                    <b>{student.name}</b>
                  </td>
                  {subjects.map((subject) => {
                    const row = studentRows.find(
                      (item) => item.subject_id === subject.id,
                    );
                    return (
                      <td key={subject.id}>
                        {row ? (
                          <button onClick={() => onEditGrade(row)}>
                            {scoreText(row.final_score)}
                            {row.manually_adjusted && <i />}
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                    );
                  })}
                  <td>
                    <b>{scoreText(average)}</b>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function GradeEditor({
  row,
  periodId,
  classId,
  profile,
  close,
  notify,
  saved,
}: {
  row: ReportRow;
  periodId: string;
  classId: string;
  profile: Profile;
  close: () => void;
  notify: Notify;
  saved: () => Promise<void>;
}) {
  const [score, setScore] = useState(
    String(row.final_score ?? row.automatic_score ?? ""),
  );
  const [description, setDescription] = useState(row.description);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    const numericScore = Number(score);
    if (!Number.isFinite(numericScore) || numericScore < 0 || numericScore > 100) {
      notify("Nilai harus berada antara 0 dan 100.", true);
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("report_grade_overrides").upsert(
      {
        period_id: periodId,
        class_id: classId,
        student_id: row.student_id,
        subject_id: row.subject_id,
        final_score: numericScore,
        description: description.trim() || null,
        updated_by: profile.id,
      },
      { onConflict: "period_id,class_id,student_id,subject_id" },
    );
    if (error) {
      setSaving(false);
      notify(error.message, true);
      return;
    }
    notify("Nilai rapor berhasil disesuaikan.");
    await saved();
  };

  const restoreAutomatic = async () => {
    if (!supabase) return;
    setSaving(true);
    const { error } = await supabase
      .from("report_grade_overrides")
      .delete()
      .eq("period_id", periodId)
      .eq("class_id", classId)
      .eq("student_id", row.student_id)
      .eq("subject_id", row.subject_id);
    if (error) {
      setSaving(false);
      notify(error.message, true);
      return;
    }
    notify("Nilai dikembalikan ke hasil otomatis.");
    await saved();
  };

  return (
    <div className="modal-overlay" onMouseDown={close}>
      <div className="modal report-grade-modal" onMouseDown={(event) => event.stopPropagation()}>
        <form className="simple-modal" onSubmit={submit}>
          <header>
            <div>
              <p>PENYESUAIAN NILAI</p>
              <h2>{row.subject_name}</h2>
            </div>
            <button type="button" onClick={close}>
              <X />
            </button>
          </header>
          <div className="modal-content">
            <div className="automatic-score-note">
              Nilai otomatis dari {row.exam_count} ujian:{" "}
              <b>{scoreText(row.automatic_score)}</b>
            </div>
            <label className="form-field">
              <span>Nilai akhir</span>
              <input
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={score}
                onChange={(event) => setScore(event.target.value)}
                required
              />
            </label>
            <label className="form-field">
              <span>Deskripsi capaian</span>
              <textarea
                rows={4}
                maxLength={1000}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                required
              />
            </label>
          </div>
          <footer>
            <button
              type="button"
              className="restore-score"
              disabled={saving || !row.manually_adjusted}
              onClick={() => void restoreAutomatic()}
            >
              Gunakan nilai otomatis
            </button>
            <div>
              <button type="button" onClick={close}>Batal</button>
              <button className="primary" disabled={saving}>
                {saving ? "Menyimpan…" : "Simpan nilai"}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}

function ComponentEditor({
  components,
  setComponents,
  close,
  save,
}: {
  components: ExamComponent[];
  setComponents: Dispatch<SetStateAction<ExamComponent[]>>;
  close: () => void;
  save: () => void;
}) {
  return (
    <div className="modal-overlay" onMouseDown={close}>
      <div className="modal wide report-component-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="simple-modal">
          <header>
            <div>
              <p>KOMPONEN NILAI</p>
              <h2>Ujian yang masuk rapor</h2>
            </div>
            <button onClick={close}>
              <X />
            </button>
          </header>
          <div className="modal-content">
            <p className="component-help">
              Bobot bersifat relatif. Contoh: bobot 2 dihitung dua kali lebih
              besar daripada bobot 1.
            </p>
            <div className="component-list">
              {components.length ? (
                components.map((component) => (
                  <div key={component.id}>
                    <input
                      type="checkbox"
                      checked={component.included}
                      aria-label={`Sertakan ${component.title}`}
                      onChange={(event) =>
                        setComponents((current) =>
                          current.map((item) =>
                            item.id === component.id
                              ? { ...item, included: event.target.checked }
                              : item,
                          ),
                        )
                      }
                    />
                    <p>
                      <b>{component.title}</b>
                      <small>
                        {component.subjectName} ·{" "}
                        {new Intl.DateTimeFormat("id-ID", {
                          dateStyle: "medium",
                        }).format(new Date(component.startsAt))}
                      </small>
                    </p>
                    <label>
                      <span>Bobot</span>
                      <input
                        type="number"
                        min={0.01}
                        max={100}
                        step={0.01}
                        value={component.weight}
                        disabled={!component.included}
                        onChange={(event) =>
                          setComponents((current) =>
                            current.map((item) =>
                              item.id === component.id
                                ? { ...item, weight: Number(event.target.value) }
                                : item,
                            ),
                          )
                        }
                      />
                    </label>
                  </div>
                ))
              ) : (
                <div className="component-empty">
                  Belum ada ujian pada kelas dan periode ini.
                </div>
              )}
            </div>
          </div>
          <footer>
            <button onClick={close}>Batal</button>
            <button className="primary" disabled={!components.length} onClick={save}>
              Simpan komponen
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
}
