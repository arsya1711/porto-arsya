# Ruang Ujian

Website ujian sekolah berbasis React, TypeScript, dan Supabase. Implementasi dibuat dari PRD `Membuat aplikasi ujian sekolah.zip` dan hanya berfokus pada platform web—tanpa aplikasi Flutter.

## Cakupan web

- Login Supabase Auth dan tiga peran: admin, guru, siswa
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
2. Jalankan [migration](./supabase/migrations/001_initial_schema.sql) melalui SQL Editor.
3. Isi `.env.local`:

```env
VITE_SUPABASE_URL=https://PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=ANON_KEY
```

4. Buat pengguna melalui Supabase Auth. Sertakan metadata berikut saat membuat akun:

```json
{
  "full_name": "Nama Pengguna",
  "role": "admin"
}
```

Nilai role yang didukung: `admin`, `guru`, atau `siswa`. Trigger database otomatis membuat baris profil ketika user Auth dibuat.

## Verifikasi

```bash
npm run build
npm run lint
```

Mode web menggunakan `localStorage` sebagai antrean autosave ringan. Kebutuhan offline native berbasis SQLite/Drift dan kiosk mode Android dari PRD sengaja tidak diimplementasikan karena berada di luar cakupan website.
