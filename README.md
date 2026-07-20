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

## Gerbang versi minimum

Saat dibuka, aplikasi membandingkan versinya dengan RPC `get_minimum_app_version`
(migrasi `016_minimum_app_version.sql` pada backend). Bila lebih lama, siswa
ditahan di layar pembaruan sebelum sempat login.

Atur ambangnya dari database:

```sql
update public.school_profile_settings set minimum_app_version = '1.1.0' where id = 1;
```

Isi `null` untuk menonaktifkan gerbang. Pemeriksaan sengaja **gagal terbuka**:
server tidak terjangkau, RPC belum terpasang, atau nilai tidak valid tidak akan
memblokir siapa pun — mengunci siswa dari ujian yang sedang berlangsung jauh
lebih merugikan daripada membiarkan klien agak tertinggal tetap berjalan.

Versi dibaca dari paket terpasang lewat `package_info_plus`, jadi cukup naikkan
`version:` di `pubspec.yaml` saat merilis.

## Font

DM Sans dan Manrope di-bundle di `assets/fonts/`, bukan diunduh saat runtime,
supaya tipografi tetap benar pada jaringan sekolah yang lambat atau memblokir
`fonts.gstatic.com`. Google Fonts kini hanya merilis variable font, sedangkan
Flutter tidak memetakan `fontWeight` ke sumbu `wght` secara otomatis, jadi static
instance dihasilkan lebih dulu:

```bash
pip install fonttools
fonttools varLib.instancer "DMSans[opsz,wght].ttf" wght=700 opsz=9 -o DMSans-700.ttf
fonttools varLib.instancer "Manrope[wght].ttf" wght=800 -o Manrope-800.ttf
```

Bobot yang dipakai aplikasi: DM Sans 400/500/600/700/800 dan Manrope 700/800.
Bila menambah bobot baru, daftarkan di `pubspec.yaml` dan pastikan namanya cocok
dengan konstanta di `lib/theme/app_theme.dart` — nama family yang salah tidak
memunculkan error, Flutter hanya diam-diam memakai Roboto. Lisensi OFL kedua font
disertakan di `assets/fonts/`.

## Distribusi Android

Aplikasi ini menargetkan Android saja. Sebelum distribusi release, salin
`android/key.properties.example` menjadi `android/key.properties`, lalu isi lokasi
dan kredensial keystore produksi. Project tidak lagi menandatangani release dengan
debug key.

Bangun APK terpisah per arsitektur, bukan APK gabungan:

```bash
flutter build apk --release --split-per-abi --dart-define-from-file=.env
```

APK gabungan berukuran ~50 MB karena memuat tiga ABI sekaligus, termasuk `x86_64`
yang hanya dipakai emulator. Versi terpisah menghasilkan ~18 MB untuk `arm64-v8a`
dan ~16 MB untuk `armeabi-v7a` — jauh lebih ringan dibagikan lewat jaringan sekolah.
Bagikan `app-arm64-v8a-release.apk` untuk perangkat modern, dan sertakan
`app-armeabi-v7a-release.apk` bila masih ada perangkat 32-bit.

R8 sudah aktif otomatis pada build release melalui Flutter Gradle plugin; tidak
perlu menyetel `isMinifyEnabled` secara manual.

Data aplikasi dikecualikan dari cadangan (`android:allowBackup="false"` dan
`res/xml/data_extraction_rules.xml`) agar jawaban ujian dan sesi Supabase tidak
ikut tersalin lewat Android Auto Backup, `adb backup`, atau transfer antarperangkat.

## Verifikasi

```bash
flutter analyze
flutter test
flutter build apk --debug
```
