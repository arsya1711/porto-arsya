# AWExam

Website ujian sekolah berbasis React, TypeScript, dan Supabase. Implementasi dibuat dari PRD `Membuat aplikasi ujian sekolah.zip` dan hanya berfokus pada platform web—tanpa aplikasi Flutter.

Audit dan status remediasi terbaru tersedia di [`docs/AUDIT_PORTO_ARSYA_2026-07-20.md`](docs/AUDIT_PORTO_ARSYA_2026-07-20.md).
Panduan varian logo putih tersedia di [`docs/PANDUAN_LOGO_PUTIH.md`](docs/PANDUAN_LOGO_PUTIH.md).
Modul operasional lengkap untuk Admin, Guru, dan Siswa tersedia dalam
[`PDF siap cetak`](docs/Modul%20Penggunaan%20AWExam.pdf) dengan
[`sumber HTML`](docs/MODUL_PENGGUNAAN_AWEXAM.html) yang dapat diperbarui.

## Cakupan web

- Login Supabase Auth, pemulihan session, reset password, dan route guard tiga peran
- Manajemen akun admin: buat akun, aktif/nonaktif, dan reset kata sandi sementara
- Dashboard aktivitas sekolah
- Daftar ujian dan wizard pembuatan ujian
- Bank soal pilihan ganda/essay, termasuk impor massal dari PDF dan foto/OCR
- Manajemen kelas dan siswa
- Koreksi essay per siswa
- Laporan nilai dan analisis butir soal
- Portal siswa dan pengerjaan ujian interaktif
- Autosave jawaban ke browser serta sinkronisasi Supabase
- Pencatatan event saat siswa meninggalkan tab ujian
- Tampilan responsif desktop, tablet, dan mobile

Supabase wajib dikonfigurasi. Aplikasi akan menolak login jika konfigurasi backend tidak tersedia agar data contoh tidak pernah muncul pada lingkungan operasional.

## Menjalankan proyek

Prasyarat: Node.js 20 atau lebih baru.

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Konfigurasi Supabase

1. Buat project Supabase.
2. Jalankan migration melalui SQL Editor secara berurutan:

   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_auth_user_management.sql`
   - `supabase/migrations/003_question_bank_crud.sql`
   - `supabase/migrations/004_dashboard_query_indexes.sql`
   - `supabase/migrations/005_staff_dashboard_metrics.sql`
   - `supabase/migrations/006_role_responsibility_separation.sql`
   - `supabase/migrations/007_school_settings.sql`
   - `supabase/migrations/008_exam_scoring.sql`
   - `supabase/migrations/009_exam_access_hardening.sql`
   - `supabase/migrations/010_atomic_exam_creation.sql`
   - `supabase/migrations/011_real_assessment_workflow.sql`
   - `supabase/migrations/012_admin_experience_settings.sql`
   - `supabase/migrations/013_safe_subject_deletion.sql`
   - `supabase/migrations/014_student_exam_contract.sql`
   - `supabase/migrations/015_exam_security_and_branding.sql`
   - `supabase/migrations/016_minimum_app_version.sql`
   - `supabase/migrations/017_optional_answer_key.sql`
   - `supabase/migrations/018_fix_attempt_status_enum_casts.sql`
   - `supabase/migrations/019_report_cards.sql`
   - `supabase/migrations/020_operational_hardening.sql`
   - `supabase/migrations/021_go_live_readiness.sql`
3. Isi `.env.local`:

```env
VITE_SUPABASE_URL=https://PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=ANON_KEY
```

4. Buat akun admin pertama melalui Supabase Dashboard → Authentication → Users. Trigger selalu membuat akun baru sebagai `siswa` untuk mencegah eskalasi role melalui metadata signup. Setelah akun dibuat, naikkan role akun bootstrap tersebut satu kali melalui SQL Editor:

```sql
update public.profiles
set role = 'admin'
where email = 'email-admin@sekolah.sch.id';
```

Pastikan hanya tepat satu akun yang cocok sebelum menjalankan query. Setelah admin bootstrap tersedia, semua akun berikutnya dibuat dan dikelola melalui menu pengguna/Edge Function `admin-users`.

5. Deploy Edge Function pengelolaan pengguna. `SUPABASE_SERVICE_ROLE_KEY` disediakan otomatis oleh runtime Supabase dan tidak boleh dimasukkan ke `.env` Vite.

```bash
npx supabase login
npx supabase link --project-ref PROJECT_REF
npx supabase functions deploy admin-users
npx supabase functions deploy student-login
npx supabase secrets set APP_ORIGIN=https://domain-sekolah.example
```

6. Tambahkan URL website ke Authentication → URL Configuration → Redirect URLs agar tautan reset kata sandi kembali ke aplikasi dengan benar.

Seluruh role diambil dari profil pengguna terautentikasi, bukan dari `localStorage`.

## Impor dan pengelolaan soal massal

Pada halaman **Bank Soal**, pilih **Impor soal**, tentukan bank tujuan, kemudian
gunakan salah satu sumber berikut:

- PDF berbasis teks/searchable PDF;
- foto soal JPG, PNG, atau WebP dengan OCR bahasa Indonesia;
- teks yang ditempel dari Word, WhatsApp, atau dokumen lain;
- dokumen Word `.docx`;
- teks Moodle GIFT;
- paket QTI `.xml` atau `.zip`.

Ukuran berkas dibatasi 10 MB dan maksimal 100 soal per proses. Impor foto
menerima maksimal lima gambar per proses. OCR berjalan di browser; saat pertama
kali digunakan, browser mengunduh mesin dan data bahasa OCR lalu menyimpannya
ke cache. Foto tidak dikirim ke backend AWExam.

Gunakan format berikut di Word atau Google Docs, kemudian ekspor sebagai PDF:

```text
SOAL 1
TIPE: PG
PERTANYAAN: Hasil dari 2 + 3 adalah ...
A. 4
B. 5
C. 6
D. 7
KUNCI: B
KESULITAN: Mudah
BOBOT: 1

SOAL 2
TIPE: ESSAY
PERTANYAAN: Jelaskan proses fotosintesis.
JAWABAN: Tumbuhan mengubah air dan karbon dioksida menjadi glukosa dengan bantuan cahaya.
KESULITAN: Sedang
BOBOT: 2
```

Preview akan menandai format tidak valid dan soal yang sudah ada di bank tujuan.
Deteksi duplikat juga mengenali pertanyaan dengan perubahan teks kecil. Hanya
soal valid yang dipilih pengguna yang dikirim ke Supabase.

Gunakan checkbox pada tabel untuk memilih banyak soal. Tombol **Kelola** dapat
menyalin soal ke bank lain atau mengubah bank, kesulitan, dan bobot secara
massal. Soal pada ujian terjadwal atau yang sudah dikerjakan tetap dilindungi
oleh trigger database dan tidak dapat diubah.

## Verifikasi

```bash
npm run build
npm run lint
npm test
npm run test:e2e
```

## Checklist go-live

- Ikuti [`docs/GO_LIVE_RUNBOOK.md`](docs/GO_LIVE_RUNBOOK.md) dan jangan membuka
  akses sebelum seluruh kriteria go/no-go lulus.
- Jalankan seluruh migration `001` sampai `021` secara berurutan pada project Supabase tujuan.
- Deploy Edge Function `admin-users` dan `student-login`, lalu pastikan secret service role hanya berada di Supabase.
- Isi secret `APP_ORIGIN` dengan origin web production. Pisahkan beberapa origin menggunakan koma, misalnya origin production dan staging.
- Isi `.env` deployment dengan URL dan anon key project production; jangan pernah memakai service-role key di Vite.
- Atur Site URL dan Redirect URLs untuk domain production pada Supabase Auth.
- Nonaktifkan public user signup pada Supabase Auth; semua akun dibuat melalui Edge Function admin.
- Buat minimal satu tahun ajaran, kelas, penugasan guru, siswa aktif, bank soal, dan soal.
- Uji alur lengkap menggunakan akun admin, guru, dan siswa pada staging sebelum ujian sebenarnya.
- Aktifkan backup database, log monitoring, HTTPS, dan kebijakan retensi data sesuai aturan sekolah.
- Pastikan jam server, jadwal ujian, dan zona waktu operator sudah benar sebelum menerbitkan ujian.

Pemeriksaan production tanpa mengubah data:

```bash
APP_URL=https://porto-arsya.pages.dev npm run go-live:check
APP_URL=https://porto-arsya.pages.dev npm run go-live:load-safe
```

Jika konfigurasi Supabase tidak tersedia, aplikasi akan berhenti pada halaman konfigurasi dan tidak menampilkan data contoh.

Mode web menggunakan `localStorage` sebagai antrean autosave ringan. Kebutuhan offline native berbasis SQLite/Drift dan kiosk mode Android dari PRD sengaja tidak diimplementasikan karena berada di luar cakupan website.
