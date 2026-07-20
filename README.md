# AWExam

Aplikasi Flutter untuk siswa berdasarkan PRD Aplikasi Ujian Sekolah dan Spesifikasi Mobile v1.1.

## Menjalankan aplikasi

```bash
flutter pub get
flutter run
```

Pada build debug, aplikasi berjalan dalam mode demo jika konfigurasi Supabase belum diberikan. Isi kredensial berikut secara manual:

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
- Review jawaban dan submit terverifikasi ke server
- Riwayat nilai dan profil siswa

Mode Supabase memuat assignment, ujian, soal, attempt, jawaban tersimpan, event integritas, dan submit melalui session siswa. Layar sukses hanya ditampilkan setelah jawaban dan attempt diterima server.

## Login Supabase dengan NIS

Mode Supabase menggunakan Edge Function `student-login` dari backend `porto-arsya`. Function mencari siswa aktif berdasarkan NIS di server, memverifikasi password melalui Supabase Auth, lalu mengembalikan session tanpa membocorkan email siswa atau service-role key.

Deploy function setelah Supabase CLI terautentikasi:

```bash
cd ../porto-arsya
supabase login
supabase link --project-ref pfjtslhsiuejjqoptvbz
supabase functions deploy student-login
```

Jalankan Flutter menggunakan anon/publishable key, bukan service-role key. Salin
`.env.example` menjadi `.env`, isi kedua nilainya, lalu:

```bash
flutter run --dart-define-from-file=.env
```

`.env` tidak dibaca oleh kode aplikasi; Flutter memuatnya menjadi `String.fromEnvironment`
saat kompilasi. File ini sudah masuk `.gitignore`. Nilainya juga bisa diberikan
satu per satu bila diperlukan:

```bash
flutter run \
  --dart-define=SUPABASE_URL=https://pfjtslhsiuejjqoptvbz.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Jika kedua `dart-define` tidak tersedia, mode demo hanya aktif otomatis pada build debug. Build release akan menolak login agar data demo tidak dipakai tanpa sengaja. Untuk build demo yang disengaja, tambahkan `--dart-define=ALLOW_DEMO=true`.

Akun Supabase harus memiliki `role = siswa`, `active = true`, NIS unik pada `profiles.student_number`, serta email/password pada Supabase Auth. Database juga harus memiliki RPC `start_exam_attempt`, `get_exam_questions`, dan `submit_exam_attempt` dari migrasi backend AWExam.

Sebelum distribusi Android release, salin `android/key.properties.example` menjadi `android/key.properties`, lalu isi lokasi dan kredensial keystore produksi. Project tidak lagi menandatangani release dengan debug key.

## Verifikasi

```bash
flutter analyze
flutter test
flutter build apk --debug
```
