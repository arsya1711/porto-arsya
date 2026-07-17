# Ruang Ujian

Website ujian sekolah berbasis React, TypeScript, dan Supabase. Implementasi dibuat dari PRD `Membuat aplikasi ujian sekolah.zip` dan hanya berfokus pada platform web—tanpa aplikasi Flutter.

## Cakupan web

- Login Supabase Auth, pemulihan session, reset password, dan route guard tiga peran
- Manajemen akun admin: buat akun, aktif/nonaktif, dan reset kata sandi sementara
- Dashboard aktivitas sekolah
- Daftar ujian dan wizard pembuatan ujian
- Bank soal pilihan ganda/essay
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
copy .env.example .env.local
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
3. Isi `.env.local`:

```env
VITE_SUPABASE_URL=https://PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=ANON_KEY
```

4. Buat akun admin pertama melalui Supabase Dashboard → Authentication → Users. Sertakan metadata:

```json
{
  "full_name": "Nama Pengguna",
  "role": "admin"
}
```

Nilai role yang didukung: `admin`, `guru`, atau `siswa`. Trigger database otomatis membuat baris profil ketika user Auth dibuat.

Jika akun sudah dibuat sebelum metadata role ditambahkan, jadikan akun tersebut admin satu kali melalui SQL Editor:

```sql
update public.profiles
set role = 'admin'
where email = 'email-admin@sekolah.sch.id';
```

5. Deploy Edge Function pengelolaan pengguna. `SUPABASE_SERVICE_ROLE_KEY` disediakan otomatis oleh runtime Supabase dan tidak boleh dimasukkan ke `.env` Vite.

```bash
npx supabase login
npx supabase link --project-ref PROJECT_REF
npx supabase functions deploy admin-users
```

6. Tambahkan URL website ke Authentication → URL Configuration → Redirect URLs agar tautan reset kata sandi kembali ke aplikasi dengan benar.

Seluruh role diambil dari profil pengguna terautentikasi, bukan dari `localStorage`.

## Verifikasi

```bash
npm run build
npm run lint
```

## Checklist go-live

- Jalankan seluruh migration `001` sampai `010` secara berurutan pada project Supabase tujuan.
- Deploy Edge Function `admin-users` dan pastikan secret service role hanya berada di Supabase.
- Isi `.env` deployment dengan URL dan anon key project production; jangan pernah memakai service-role key di Vite.
- Atur Site URL dan Redirect URLs untuk domain production pada Supabase Auth.
- Buat minimal satu tahun ajaran, kelas, penugasan guru, siswa aktif, bank soal, dan soal.
- Uji alur lengkap menggunakan akun admin, guru, dan siswa pada staging sebelum ujian sebenarnya.
- Aktifkan backup database, log monitoring, HTTPS, dan kebijakan retensi data sesuai aturan sekolah.
- Pastikan jam server, jadwal ujian, dan zona waktu operator sudah benar sebelum menerbitkan ujian.

Jika konfigurasi Supabase tidak tersedia, aplikasi akan berhenti pada halaman konfigurasi dan tidak menampilkan data contoh.

Mode web menggunakan `localStorage` sebagai antrean autosave ringan. Kebutuhan offline native berbasis SQLite/Drift dan kiosk mode Android dari PRD sengaja tidak diimplementasikan karena berada di luar cakupan website.
