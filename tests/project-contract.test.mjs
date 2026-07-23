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
  const syncPosition = app.indexOf('const finalSaves = await Promise.all(')
  const submitPosition = app.indexOf('supabase.rpc("submit_exam_attempt"', syncPosition)
  assert.ok(syncPosition >= 0)
  assert.ok(submitPosition > syncPosition)
  assert.match(app, /remaining > 3 \|\| !pendingEssay\.current/)
  assert.match(app, /expiredSaves\.some\(\(\{ error \}\) => Boolean\(error\)\)/)
  assert.match(app, /if \(!expiredSaveFailed\) \{\s*localStorage\.removeItem/)
})

test('Edge Function membatasi origin dan memakai RPC transaksional', async () => {
  const [admin, login] = await Promise.all([
    read('supabase/functions/admin-users/index.ts'),
    read('supabase/functions/student-login/index.ts'),
  ])
  assert.match(admin, /APP_ORIGIN/)
  assert.match(admin, /save_managed_user_profile/)
  assert.match(login, /APP_ORIGIN/)
  assert.match(login, /reserve_student_login_attempt/)
  assert.doesNotMatch(`${admin}\n${login}`, /Access-Control-Allow-Origin': '\*'/)
})

test('rapor memakai nilai final, akses terkontrol, dan menyediakan cetak A4', async () => {
  const [migration, page, styles, app] = await Promise.all([
    read('supabase/migrations/019_report_cards.sql'),
    read('src/components/ReportCardsPage.tsx'),
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
})
