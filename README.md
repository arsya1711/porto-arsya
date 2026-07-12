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

Tombol mode demo di halaman login dapat digunakan sebelum Supabase dikonfigurasi.

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

Saat Supabase dikonfigurasi, tombol login demo otomatis disembunyikan. Seluruh role diambil dari profil pengguna terautentikasi, bukan dari `localStorage`.

## Verifikasi

```bash
npm run build
npm run lint
```

Mode web menggunakan `localStorage` sebagai antrean autosave ringan. Kebutuhan offline native berbasis SQLite/Drift dan kiosk mode Android dari PRD sengaja tidak diimplementasikan karena berada di luar cakupan website.
