import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('branding AWExam konsisten pada metadata dan komponen logo', async () => {
  const [html, logo, app] = await Promise.all([
    read('index.html'),
    read('src/components/BrandLogo.tsx'),
    read('src/App.tsx'),
  ])
  assert.match(html, /<title>AWExam<\/title>/)
  assert.match(logo, /src="\/logo-white\.png"/)
  assert.match(app, /Mts Alhidayah Wattaqwa/)
  assert.doesNotMatch(app, /<h2>Selamat datang<\/h2>/)
})

test('migration keamanan menghapus plaintext dan membatasi kode akses', async () => {
  const migration = await read('supabase/migrations/015_exam_security_and_branding.sql')
  assert.match(migration, /access_code_hash/)
  assert.match(migration, /gen_salt\('bf', 10\)/)
  assert.match(migration, /recent_failures >= 8/)
  assert.match(migration, /student_attempt_is_active/)
  assert.match(migration, /students log active integrity/)
})

test('submit ujian menyinkronkan seluruh jawaban sebelum finalisasi', async () => {
  const app = await read('src/App.tsx')
  const syncPosition = app.indexOf('supabase.rpc("save_exam_answers_batch"')
  const submitPosition = app.indexOf('supabase.rpc("submit_exam_attempt"', syncPosition)
  assert.ok(syncPosition >= 0)
  assert.ok(submitPosition > syncPosition)
  assert.match(app, /const answerPayload = Object\.entries\(answers\)/)
  assert.match(app, /answer_payload: answerPayload/)
  assert.match(app, /remaining > 3 \|\| !pendingEssay\.current/)
  assert.match(app, /expiredSaves\.some\(\(\{ error \}\) => Boolean\(error\)\)/)
  assert.match(app, /if \(!expiredSaveFailed\) \{\s*localStorage\.removeItem/)
  assert.match(app, /unsyncedAnswersRef/)
  assert.match(app, /window\.addEventListener\("online", retryUnsyncedAnswers\)/)
  assert.match(app, /submitRetryRef/)
  assert.match(app, /window\.addEventListener\("online", retryPendingSubmit\)/)
  assert.match(app, /jawaban belum tersinkron/)
})

test('Edge Function membatasi origin dan memakai RPC transaksional', async () => {
  const [admin, login, loginRateLimit] = await Promise.all([
    read('supabase/functions/admin-users/index.ts'),
    read('supabase/functions/student-login/index.ts'),
    read('supabase/migrations/022_student_login_rate_limit.sql'),
  ])
  assert.match(admin, /APP_ORIGIN/)
  assert.match(admin, /save_managed_user_profile/)
  assert.match(login, /APP_ORIGIN/)
  assert.match(login, /reserve_student_login_attempt/)
  assert.match(login, /clear_student_login_attempts/)
  assert.match(loginRateLimit, /ip_attempts >= 500/)
  assert.match(loginRateLimit, /delete from public\.student_login_attempts/)
  assert.doesNotMatch(`${admin}\n${login}`, /Access-Control-Allow-Origin': '\*'/)
})

test('rapor memakai nilai final, akses terkontrol, dan menyediakan cetak A4', async () => {
  const [migration, page, studentPage, styles, app] = await Promise.all([
    read('supabase/migrations/019_report_cards.sql'),
    read('src/components/ReportCardsPage.tsx'),
    read('src/components/StudentReportPage.tsx'),
    read('src/styles-report-cards.css'),
    read('src/App.tsx'),
  ])
  assert.match(migration, /attempt\.status = 'final'/)
  assert.match(migration, /attempt\.final_score is not null/)
  assert.match(migration, /enable row level security/)
  assert.match(migration, /get_report_card_data/)
  assert.match(migration, /audit_report_change/)
  assert.match(page, /Komponen nilai/)
  assert.match(page, /Publikasikan rapor/)
  assert.match(page, /window\.print\(\)/)
  assert.match(styles, /@page\{size:A4 portrait/)
  assert.match(app, /path="rapor"/)
  assert.match(app, /path="\/siswa\/rapor"/)
  assert.match(studentPage, /get_report_card_data/)
  assert.match(studentPage, /Rapor yang telah dipublikasikan/)
})

test('deployment SPA dan hardening operasional tersedia', async () => {
  const [vercel, migration, securityMigration, indexMigration, importer, boundary] = await Promise.all([
    read('vercel.json'),
    read('supabase/migrations/020_operational_hardening.sql'),
    read('supabase/migrations/023_security_advisor_hardening.sql'),
    read('supabase/migrations/024_remove_duplicate_question_index.sql'),
    read('supabase/functions/import-questions/index.ts'),
    read('src/components/ErrorBoundary.tsx'),
  ])
  assert.match(vercel, /index\.html/)
  assert.match(vercel, /Content-Security-Policy/)
  assert.match(vercel, /worker-src 'self' blob:/)
  assert.doesNotMatch(vercel, /api\\.cerebras\\.ai/)
  assert.doesNotMatch(vercel, /img-src[^;]*\shttps:(?:\s|;)/)
  assert.match(migration, /academic_years_name_format/)
  assert.match(migration, /reserve_ai_import_attempt/)
  assert.match(migration, /frontend_error_logs/)
  assert.match(securityMigration, /procedure\.prosecdef/)
  assert.match(securityMigration, /procedure\.prorettype = 'trigger'::regtype/)
  assert.match(securityMigration, /get_minimum_app_version/)
  assert.match(securityMigration, /drop policy if exists "public reads school assets"/)
  assert.match(indexMigration, /drop index if exists public\.questions_bank_archived_created_idx/)
  assert.match(importer, /reserve_ai_import_attempt/)
  assert.match(boundary, /frontend_error_logs/)
})

test('query data besar dibatasi agar tetap aman pada dataset yang tumbuh', async () => {
  const pagination = await read('src/lib/supabase-pagination.ts')
  assert.match(pagination, /maxRows/)
  assert.match(pagination, /pageSize = 250/)
  assert.match(pagination, /rows\.length >= maxRows/)
})

test('go-live memiliki Realtime, fallback refresh, dan pemeriksaan production', async () => {
  const [migration, dashboard, packageJson, preflight, runbook] = await Promise.all([
    read('supabase/migrations/021_go_live_readiness.sql'),
    read('src/components/Dashboards.tsx'),
    read('package.json'),
    read('tool/go-live-check.mjs'),
    read('docs/GO_LIVE_RUNBOOK.md'),
  ])
  assert.match(migration, /alter publication supabase_realtime add table/)
  assert.match(migration, /array\['attempts', 'exams', 'class_students'\]/)
  assert.match(dashboard, /window\.setInterval\(refreshVisibleDashboard, 60_000\)/)
  assert.match(packageJson, /go-live:check/)
  assert.match(packageJson, /go-live:roles/)
  assert.match(packageJson, /go-live:load-safe/)
  assert.match(preflight, /auth\/v1\/health/)
  assert.match(preflight, /access-control-allow-origin/)
  assert.match(runbook, /Keputusan: GO \/ NO-GO/)
})

test('form login mengikuti lebar viewport ponsel tanpa overflow', async () => {
  const styles = await read('src/styles-responsive.css')
  assert.match(styles, /@media \(max-width: 760px\)/)
  assert.match(
    styles,
    /\.login-panel form \{\s*width: 100%;\s*max-width: 100%;\s*flex: 0 1 400px;/,
  )
  assert.match(
    styles,
    /\.login-panel \.input-box,\s*\.login-panel \.login-button \{\s*width: 100%;\s*max-width: 100%;/,
  )
  assert.match(styles, /\.login-help \{[\s\S]*?flex-wrap: wrap;/)
})

test('aksesibilitas modal, refresh siswa, dan validasi profil sekolah aktif', async () => {
  const [dialog, dashboard, settings, assessment] = await Promise.all([
    read('src/lib/use-accessible-dialog.ts'),
    read('src/components/Dashboards.tsx'),
    read('src/components/SettingsPage.tsx'),
    read('src/components/AssessmentPages.tsx'),
  ])
  assert.match(dialog, /event\.key === "Escape"/)
  assert.match(dialog, /event\.key !== "Tab"/)
  assert.match(dialog, /previouslyFocused\?\.focus\(\)/)
  assert.match(dashboard, /student-dashboard:/)
  assert.match(dashboard, /Perbarui jadwal/)
  assert.match(settings, /NPSN harus terdiri dari tepat 8 angka/)
  assert.doesNotMatch(settings, /image\/svg\+xml/)
  assert.match(assessment, /fetchAllPages/)
  assert.match(assessment, /grading-pagination/)
})

test('migration melindungi waktu server, konfigurasi, dan admin terakhir', async () => {
  const [serverClock, settings, adminGuard] = await Promise.all([
    read('supabase/migrations/026_server_clock.sql'),
    read('supabase/migrations/027_restore_operational_settings.sql'),
    read('supabase/migrations/028_protect_last_admin.sql'),
  ])
  assert.match(serverClock, /get_server_time/i)
  assert.match(serverClock, /security invoker/i)
  assert.match(settings, /minimum_app_version/i)
  assert.match(adminGuard, /pg_advisory_xact_lock/i)
  assert.match(adminGuard, /profiles_protect_last_active_admin/i)
})

test('percobaan ulang kode akses membersihkan error lama sebelum memuat ujian', async () => {
  const app = await read('src/App.tsx')
  assert.match(
    app,
    /const load = async \(\) => \{\s*setLoadingExam\(true\);\s*(?:\/\/[^\n]*\n\s*)*setExamError\(""\);/,
  )
})

test('policy integritas siswa tidak bergantung pada SELECT langsung ke exams', async () => {
  const migration = await read('supabase/migrations/029_fix_student_integrity_policy.sql')
  assert.match(migration, /can_record_student_integrity_event/)
  assert.match(migration, /security definer/i)
  assert.match(migration, /attempt\.student_id = auth\.uid\(\)/)
  assert.match(migration, /exam\.record_tab_switches/)
  assert.match(migration, /attempt\.status = 'in_progress'/)
  assert.match(migration, /octet_length/)
  assert.match(migration, /to authenticated/)
  assert.match(migration, /from public, anon/)
})

test('mata pelajaran dikonfigurasi manual per kelas dan dipakai secara konsisten', async () => {
  const [migration, adminPage, app, assessment] = await Promise.all([
    read('supabase/migrations/030_class_subjects.sql'),
    read('src/components/AdminPages.tsx'),
    read('src/App.tsx'),
    read('src/components/AssessmentPages.tsx'),
  ])
  assert.match(migration, /create table public\.class_subjects/)
  assert.match(migration, /save_subject_with_classes/)
  assert.match(migration, /teacher_subjects_class_subject_fk/)
  assert.match(migration, /exams_class_subject_fk/)
  assert.match(adminPage, /Tersedia untuk kelas/)
  assert.match(adminPage, /selectedClassIds/)
  assert.match(app, /class_subjects/)
  assert.match(assessment, /subjectsForClass/)
})

test('ekspor akun siswa memakai workbook bergaya tanpa mengubah ekspor peran lain', async () => {
  const [app, workbook, adminFunction] = await Promise.all([
    read('src/App.tsx'),
    read('src/lib/student-account-workbook.ts'),
    read('supabase/functions/admin-users/index.ts'),
  ])
  assert.match(app, /PASSWORD SEMENTARA/)
  assert.match(app, /temporaryPasswords/)
  assert.match(app, /Reset diperlukan/)
  assert.match(app, /File Excel akan memuat.*password sementara/)
  assert.match(app, /if \(roleFilter !== "siswa"\)/)
  assert.match(app, /\["Nama", "Email", "Peran", "Status", "Dibuat"\]/)
  assert.match(app, /roleFilter === "siswa" && typeof result\?\.user_id/)
  assert.match(app, /buildStudentAccountWorkbook/)
  assert.match(app, /Ekspor Excel/)
  assert.match(workbook, /state=\"frozen\"/)
  assert.match(workbook, /autoFilter/)
  assert.match(workbook, /PASSWORD SEMENTARA/)
  assert.match(adminFunction, /caller\.role === 'guru'/)
  assert.match(adminFunction, /teacher_subjects/)
  assert.match(adminFunction, /homeroom_teacher_id/)
  assert.match(adminFunction, /Guru hanya dapat mengatur password siswa pada kelas yang diampu/)
})

test('Audit & Keamanan memprioritaskan log error dengan retensi tujuh hari', async () => {
  const [page, migration] = await Promise.all([
    read('src/components/AdminPages.tsx'),
    read('supabase/migrations/031_frontend_error_log_retention.sql'),
  ])
  assert.match(page, /Log Error Website/)
  assert.match(page, /useState<"integrity" \| "errors">\("errors"\)/)
  assert.doesNotMatch(page, /Aktivitas sistem/)
  assert.match(page, /Log yang berusia lebih dari 7 hari dihapus otomatis/)
  assert.match(migration, /create extension if not exists pg_cron/)
  assert.match(migration, /created_at < now\(\) - interval '7 days'/)
  assert.match(migration, /purge-frontend-error-logs-daily/)
  assert.match(migration, /20 17 \* \* \*/)
})

test('form ujian meminta jadwal mulai dan selesai lalu server membatasi deadline', async () => {
  const [assessment, migration] = await Promise.all([
    read('src/components/AssessmentPages.tsx'),
    read('supabase/migrations/014_student_exam_contract.sql'),
  ])
  assert.match(assessment, /Tanggal & jam mulai/)
  assert.match(assessment, /Tanggal & jam selesai/)
  assert.match(assessment, /schoolDateTimeRangeMinutes\(draft\.startsAt, draft\.endsAt/)
  assert.match(assessment, /duration_in_minutes: duration/)
  assert.match(migration, /least\([\s\S]*target_attempt\.started_at \+ make_interval\(mins => target_exam\.duration_minutes\)[\s\S]*target_exam\.ends_at/)
})

test('kumpulan ujian mempertahankan urutan asli dan memuat hasil per ujian', async () => {
  const [assessment, migration] = await Promise.all([
    read('src/components/AssessmentPages.tsx'),
    read('supabase/migrations/015_exam_security_and_branding.sql'),
  ])
  assert.match(assessment, /title="Kumpulan Ujian"/)
  assert.match(assessment, /Hasil siswa/)
  assert.match(assessment, /\.order\("position", \{ ascending: true \}\)/)
  assert.match(assessment, /urutan asli yang tetap/)
  assert.match(migration, /when exam\.shuffle_questions then[\s\S]*hashtextextended\(question\.id::text, hashtextextended\(attempt\.id::text, 0\)\)/)
  assert.match(migration, /else exam_question\.position::bigint/)
})

test('bank soal menyembunyikan kesulitan dan membatasi bobot untuk essay', async () => {
  const [bank, bulkTools, importer, migration] = await Promise.all([
    read('src/components/QuestionBank.tsx'),
    read('src/components/QuestionBulkToolsModal.tsx'),
    read('src/components/PdfQuestionImportModal.tsx'),
    read('supabase/migrations/033_question_weight_by_type.sql'),
  ])
  assert.doesNotMatch(bank, /Filter tingkat kesulitan/)
  assert.doesNotMatch(bank, /<th>TINGKAT<\/th>/)
  assert.doesNotMatch(bank, /label="Tingkat kesulitan"/)
  assert.match(bank, /question\.type === "Essay" \? question\.weight \?\? 1 : "—"/)
  assert.match(bank, /weight: draft\.type === "Essay" \? draft\.weight : 1/)
  assert.doesNotMatch(bulkTools, /<span>Kesulitan<\/span>/)
  assert.match(bulkTools, /Bobot hanya dapat diubah jika semua soal yang dipilih berupa essay/)
  assert.doesNotMatch(importer, /KESULITAN:/)
  assert.match(importer, /question\.type === "Essay" \? ` · bobot/)
  assert.match(migration, /new\.type = 'multiple_choice'/)
  assert.match(migration, /new\.weight := 1/)
  assert.match(migration, /questions_multiple_choice_static_weight/)
})

test('guru dapat mengawasi, menghentikan, dan melanjutkan sesi siswa secara aman', async () => {
  const [assessment, app, migration] = await Promise.all([
    read('src/components/AssessmentPages.tsx'),
    read('src/App.tsx'),
    read('supabase/migrations/034_live_exam_monitoring.sql'),
  ])
  assert.match(assessment, /Awasi ujian/)
  assert.match(assessment, /currentExamStatus\(exam\) === "selesai"/)
  assert.match(assessment, /Ujian sudah berakhir\. Pengawasan langsung tidak dapat dibuka\./)
  assert.match(assessment, /get_exam_monitor/)
  assert.match(assessment, /set_student_attempt_paused/)
  assert.match(assessment, /Indikasi keluar halaman \{row\.exitCount\}/)
  assert.match(app, /get_student_attempt_control/)
  assert.match(app, /Sesi dihentikan sementara oleh guru/)
  assert.match(migration, /add column if not exists paused_at timestamptz/)
  assert.match(migration, /not public\.teacher_owns_exam\(target_exam_id\)/)
  assert.match(migration, /attempt\.paused_at is null/)
  assert.match(migration, /event_type in \('tab_hidden', 'app_backgrounded'\)/)
  assert.match(migration, /alter publication supabase_realtime add table public\.integrity_events/)
})

test('operasional ujian 1-7 tersedia tanpa analisis butir tambahan', async () => {
  const [assessment, app, bank, migration] = await Promise.all([
    read('src/components/AssessmentPages.tsx'),
    read('src/App.tsx'),
    read('src/components/QuestionBank.tsx'),
    read('supabase/migrations/035_exam_operations_and_essay_rubrics.sql'),
  ])

  assert.match(migration, /finalize_expired_exam_attempts/)
  assert.match(migration, /finalize-expired-exam-attempts/)
  assert.match(migration, /save_exam_answers_batch/)
  assert.match(migration, /touch_exam_attempt/)
  assert.match(migration, /set_exam_attempts_paused/)
  assert.match(migration, /grant_attempt_extra_time/)
  assert.match(migration, /force_submit_exam_attempt/)
  assert.match(migration, /reset_exam_attempt/)
  assert.match(migration, /get_attempt_integrity_timeline/)
  assert.match(migration, /rubric_scores_payload jsonb/)

  assert.match(app, /window\.setInterval\(sendHeartbeat, 15_000\)/)
  assert.match(assessment, /Hentikan semua/)
  assert.match(assessment, /Tambahkan waktu untuk/)
  assert.match(assessment, /Kumpulkan paksa ujian/)
  assert.match(assessment, /Catatan ini adalah sinyal untuk ditinjau, bukan bukti kecurangan/)
  assert.match(assessment, /RubricScoreEditor/)
  assert.match(bank, /Rubrik penilaian/)
})

test('dashboard siswa tidak mengambil atau menampilkan nilai ujian secara langsung', async () => {
  const dashboard = await read('src/components/Dashboards.tsx')
  assert.doesNotMatch(dashboard, /finalScore/)
  assert.doesNotMatch(dashboard, /select\("id,exam_id,status,final_score/)
  assert.match(dashboard, /Sudah dikumpulkan/)
  assert.match(dashboard, /Rapor terpublikasi/)
})
