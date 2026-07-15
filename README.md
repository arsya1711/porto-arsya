# Ruang Ujian Siswa

Aplikasi Flutter untuk siswa berdasarkan PRD Aplikasi Ujian Sekolah dan Spesifikasi Mobile v1.1.

## Menjalankan aplikasi

```bash
flutter pub get
flutter run
```

Tanpa konfigurasi Supabase, aplikasi berjalan dalam mode demo. Isi kredensial berikut secara manual:

- NIS: `24001`
- Kata sandi: `siswa123`
- Kode akses ujian: `UJIAN`

## Cakupan prototipe

- Login siswa
- Beranda ujian tersedia dan akan datang
- Detail, instruksi, aturan keamanan, dan kode akses
- Ruang ujian pilihan ganda dan essay
- Timer, navigasi soal, penanda ragu, dan indikator autosave/sinkronisasi
- Pencatatan event ketika aplikasi ditinggalkan
- Review jawaban dan submit online/offline
- Riwayat nilai dan profil siswa

Login dapat memakai Supabase, sedangkan katalog ujian dan pertanyaan masih memakai fallback `DemoRepository`. Tahap berikutnya adalah memuat assignment, ujian, pertanyaan, attempt, dan jawaban melalui session Supabase yang sekarang sudah tersedia.

## Login Supabase dengan NIS

Mode Supabase menggunakan Edge Function `student-login` dari backend `porto-arsya`. Function mencari siswa berdasarkan NIS di server, memverifikasi password melalui Supabase Auth, lalu mengembalikan session tanpa membocorkan email siswa atau service-role key.

Deploy function setelah Supabase CLI terautentikasi:

```bash
cd ../porto-arsya
supabase login
supabase link --project-ref pfjtslhsiuejjqoptvbz
supabase functions deploy student-login
```

Jalankan Flutter menggunakan anon/publishable key, bukan service-role key:

```bash
flutter run \
  --dart-define=SUPABASE_URL=https://pfjtslhsiuejjqoptvbz.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Jika kedua `dart-define` tidak tersedia, aplikasi otomatis memakai mode demo. Akun Supabase harus memiliki `role = siswa`, `active = true`, NIS unik pada `profiles.student_number`, serta email/password pada Supabase Auth.

## Verifikasi

```bash
flutter analyze
flutter test
flutter build apk --debug
```
