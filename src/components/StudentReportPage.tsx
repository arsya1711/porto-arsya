import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpenCheck,
  Download,
  GraduationCap,
  LoaderCircle,
  LogOut,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { Profile } from "../auth/auth-context";
import { supabase } from "../lib/supabase";
import { BrandLogo } from "./BrandLogo";

type Publication = {
  periodId: string;
  classId: string;
  periodName: string;
  academicYear: string;
  semester: number;
  publishedAt: string | null;
};

type ReportRow = {
  subject_id: string;
  subject_name: string;
  subject_code: string;
  final_score: number | null;
  predicate: string;
  description: string;
  exam_count: number;
};

type StudentNote = {
  homeroom_note: string | null;
  extracurricular: string | null;
  sick_days: number;
  permitted_days: number;
  absent_days: number;
};

function record(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) return (value[0] ?? {}) as Record<string, unknown>;
  return (value ?? {}) as Record<string, unknown>;
}

function score(value: number | null) {
  return value === null
    ? "—"
    : value.toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

export function StudentReportPage({
  profile,
  logout,
}: {
  profile: Profile;
  logout: () => void;
}) {
  const [publications, setPublications] = useState<Publication[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [className, setClassName] = useState("Kelas");
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [note, setNote] = useState<StudentNote | null>(null);
  const [school, setSchool] = useState({
    name: "Mts Alhidayah Wattaqwa",
    address: "",
    npsn: "",
    logoUrl: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOptions = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError("");
    const [membershipResult, schoolResult] = await Promise.all([
      supabase
        .from("class_students")
        .select("class_id,classes(name)")
        .eq("student_id", profile.id)
        .maybeSingle(),
      supabase
        .from("school_profile_settings")
        .select("school_name,address,npsn,logo_url")
        .eq("id", 1)
        .maybeSingle(),
    ]);
    if (membershipResult.error) {
      setError(membershipResult.error.message);
      setLoading(false);
      return;
    }
    const classId = membershipResult.data?.class_id;
    setClassName(String(record(membershipResult.data?.classes).name ?? "Kelas"));
    if (schoolResult.data) {
      setSchool({
        name: schoolResult.data.school_name || "Mts Alhidayah Wattaqwa",
        address: schoolResult.data.address || "",
        npsn: schoolResult.data.npsn || "",
        logoUrl: schoolResult.data.logo_url || "",
      });
    }
    if (!classId) {
      setPublications([]);
      setLoading(false);
      return;
    }
    const publicationResult = await supabase
      .from("report_publications")
      .select(
        "period_id,class_id,published_at,report_periods(name,semester,starts_on,academic_years(name))",
      )
      .eq("class_id", classId)
      .eq("published", true)
      .order("published_at", { ascending: false });
    if (publicationResult.error) {
      setError(publicationResult.error.message);
      setLoading(false);
      return;
    }
    const nextPublications = (publicationResult.data ?? []).map((item) => {
      const period = record(item.report_periods);
      const academicYear = record(period.academic_years);
      return {
        periodId: item.period_id,
        classId: item.class_id,
        periodName: String(period.name ?? "Semester"),
        academicYear: String(academicYear.name ?? "—"),
        semester: Number(period.semester ?? 0),
        publishedAt: item.published_at,
      };
    });
    setPublications(nextPublications);
    setSelectedPeriod((current) =>
      nextPublications.some((item) => item.periodId === current)
        ? current
        : nextPublications[0]?.periodId ?? "",
    );
    setLoading(false);
  }, [profile.id]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    const client = supabase;
    const selected = publications.find(
      (item) => item.periodId === selectedPeriod,
    );
    if (!client || !selected) {
      setRows([]);
      setNote(null);
      return;
    }
    let active = true;
    const loadReport = async () => {
      setLoading(true);
      setError("");
      const [reportResult, noteResult] = await Promise.all([
        client.rpc("get_report_card_data", {
          target_period_id: selected.periodId,
          target_class_id: selected.classId,
        }),
        client
          .from("report_student_notes")
          .select(
            "homeroom_note,extracurricular,sick_days,permitted_days,absent_days",
          )
          .eq("period_id", selected.periodId)
          .eq("class_id", selected.classId)
          .eq("student_id", profile.id)
          .maybeSingle(),
      ]);
      if (!active) return;
      const loadError = reportResult.error ?? noteResult.error;
      if (loadError) {
        setError(loadError.message);
      } else {
        setRows(
          (reportResult.data ?? []).map((item: Record<string, unknown>) => ({
            subject_id: String(item.subject_id),
            subject_name: String(item.subject_name),
            subject_code: String(item.subject_code ?? ""),
            final_score:
              item.final_score === null ? null : Number(item.final_score),
            predicate: String(item.predicate ?? "—"),
            description: String(item.description ?? ""),
            exam_count: Number(item.exam_count ?? 0),
          })),
        );
        setNote((noteResult.data as StudentNote | null) ?? null);
      }
      setLoading(false);
    };
    void loadReport();
    return () => {
      active = false;
    };
  }, [profile.id, publications, selectedPeriod]);

  const selected = publications.find(
    (item) => item.periodId === selectedPeriod,
  );
  const average = useMemo(() => {
    const scores = rows.flatMap((row) =>
      row.final_score === null ? [] : [row.final_score],
    );
    return scores.length
      ? scores.reduce((total, value) => total + value, 0) / scores.length
      : null;
  }, [rows]);

  return (
    <div className="student-report-page">
      <header className="student-report-topbar">
        <Link to="/siswa" className="student-logo">
          <BrandLogo /> <b>AWExam</b>
        </Link>
        <div>
          <Link to="/siswa">
            <ArrowLeft /> Kembali
          </Link>
          <button onClick={logout}>
            <LogOut /> Keluar
          </button>
        </div>
      </header>

      <main>
        <div className="student-report-heading">
          <div>
            <p>HASIL BELAJAR</p>
            <h1>Nilai & Rapor</h1>
            <span>Rapor yang telah dipublikasikan oleh sekolah.</span>
          </div>
          {publications.length > 0 && (
            <div>
              <label htmlFor="student-report-period">Periode</label>
              <select
                id="student-report-period"
                value={selectedPeriod}
                onChange={(event) => setSelectedPeriod(event.target.value)}
              >
                {publications.map((publication) => (
                  <option
                    key={publication.periodId}
                    value={publication.periodId}
                  >
                    {publication.periodName} · {publication.academicYear}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {loading ? (
          <section className="student-report-state">
            <LoaderCircle className="spin" />
            <h2>Memuat rapor…</h2>
          </section>
        ) : error ? (
          <section className="student-report-state error">
            <AlertTriangle />
            <h2>Rapor belum dapat dimuat</h2>
            <p>{error}</p>
            <button onClick={() => void loadOptions()}>Coba lagi</button>
          </section>
        ) : !selected ? (
          <section className="student-report-state">
            <BookOpenCheck />
            <h2>Belum ada rapor yang dipublikasikan</h2>
            <p>Rapor akan muncul setelah dipublikasikan oleh wali kelas.</p>
          </section>
        ) : (
          <article className="student-report-sheet">
            <header>
              {school.logoUrl ? (
                <img src={school.logoUrl} alt="Logo sekolah" />
              ) : (
                <span><GraduationCap /></span>
              )}
              <div>
                <small>LAPORAN HASIL BELAJAR</small>
                <h2>{school.name}</h2>
                <p>
                  {school.address || "Alamat sekolah belum diatur"}
                  {school.npsn ? ` · NPSN ${school.npsn}` : ""}
                </p>
              </div>
              <button onClick={() => window.print()}>
                <Download /> Simpan PDF
              </button>
            </header>

            <dl className="student-report-identity">
              <div><dt>Nama siswa</dt><dd>{profile.full_name}</dd></div>
              <div><dt>NIS</dt><dd>{profile.student_number || "—"}</dd></div>
              <div><dt>Kelas</dt><dd>{className}</dd></div>
              <div>
                <dt>Periode</dt>
                <dd>{selected.periodName} · {selected.academicYear}</dd>
              </div>
            </dl>

            <div className="student-report-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>No.</th>
                    <th>Mata pelajaran</th>
                    <th>Nilai</th>
                    <th>Predikat</th>
                    <th>Capaian kompetensi</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length ? rows.map((row, index) => (
                    <tr key={row.subject_id}>
                      <td>{index + 1}</td>
                      <td>
                        <b>{row.subject_name}</b>
                        <small>{row.subject_code || "—"} · {row.exam_count} ujian</small>
                      </td>
                      <td><b>{score(row.final_score)}</b></td>
                      <td><span>{row.predicate}</span></td>
                      <td>{row.description}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={5}>Belum ada nilai final pada periode ini.</td></tr>
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}>Rata-rata</td>
                    <td><b>{score(average)}</b></td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="student-report-notes">
              <section>
                <h3>Catatan wali kelas</h3>
                <p>{note?.homeroom_note || "Belum ada catatan wali kelas."}</p>
              </section>
              <section>
                <h3>Ekstrakurikuler / prestasi</h3>
                <p>{note?.extracurricular || "Belum ada data ekstrakurikuler."}</p>
              </section>
              <section>
                <h3>Ketidakhadiran</h3>
                <dl>
                  <div><dt>Sakit</dt><dd>{note?.sick_days ?? 0} hari</dd></div>
                  <div><dt>Izin</dt><dd>{note?.permitted_days ?? 0} hari</dd></div>
                  <div><dt>Tanpa keterangan</dt><dd>{note?.absent_days ?? 0} hari</dd></div>
                </dl>
              </section>
            </div>
          </article>
        )}
      </main>
    </div>
  );
}
