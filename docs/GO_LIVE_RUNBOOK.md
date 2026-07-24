# Runbook Go-Live AWExam

Dokumen ini dipakai operator teknis sebelum, saat, dan sesudah AWExam mulai
digunakan. Target utama adalah mencegah perubahan mendadak ketika ujian sedang
berjalan dan menyediakan langkah pemulihan yang jelas.

## Status yang wajib hijau

Go-live hanya boleh dilanjutkan jika seluruh kondisi berikut terpenuhi:

- `npm run check` lulus;
- `npm run check:functions` lulus;
- `npm run test:e2e` lulus;
- `npm run go-live:check` lulus pada domain yang akan dibagikan;
- `npm run go-live:load-safe` memiliki keberhasilan minimal 99% dan p95 di
  bawah 5 detik;
- migrasi lokal dan remote sama setelah `supabase migration list`;
- akun uji Admin, Guru, dan Siswa berhasil login;
- satu simulasi ujian lengkap berhasil dari mulai, autosave, pindah soal,
  putus-sambung jaringan, kumpulkan, koreksi, sampai nilai final;
- jadwal dan zona waktu sekolah telah diperiksa oleh operator;
- tidak ada perubahan fitur baru setelah simulasi final.

Jika salah satu kondisi gagal, statusnya **no-go** sampai penyebabnya diperbaiki
dan seluruh pemeriksaan terkait diulang.

## H-1 sebelum digunakan

1. Tentukan satu domain resmi, disarankan
   `https://porto-arsya.pages.dev`. Domain lain hanya sebagai cadangan.
2. Pastikan daftar siswa, NIS, kelas, mata pelajaran, guru, jadwal, durasi,
   jumlah soal, bobot, dan kunci jawaban sudah benar.
3. Pastikan semua siswa yang ikut ujian berstatus aktif dan ditugaskan ke ujian.
4. Jangan mengedit soal setelah ujian diterbitkan.
5. Siapkan satu akun uji untuk tiap role. Jangan memakai akun siswa sungguhan
   untuk pemeriksaan berulang.
6. Verifikasi backup terbaru melalui Supabase Dashboard. Bila perlu membuat
   salinan SQL lokal, gunakan folder yang tidak masuk Git dan jangan unggah
   hasil dump ke repositori.
7. Catat commit Git yang sedang aktif:

   ```bash
   git rev-parse HEAD
   ```

8. Simpan nama deployment web terakhir yang diketahui stabil dari dashboard
   Cloudflare Pages atau Vercel.

## Urutan rilis

Jalankan dari folder `porto-arsya`:

```bash
npm ci
npm run check
npm run check:functions
npm run test:e2e
supabase migration list
```

Migrasi `021_go_live_readiness.sql` harus diterapkan sebelum web terbaru:

```bash
supabase db push
supabase migration list
```

Karena fungsi login siswa juga diperbarui, deploy fungsi tersebut:

```bash
supabase functions deploy student-login
supabase functions list
```

Commit dan push ke branch deployment hanya setelah pemeriksaan lokal lulus.
Setelah hosting selesai membangun, jalankan:

```bash
APP_URL=https://porto-arsya.pages.dev npm run go-live:check
APP_URL=https://porto-arsya.pages.dev npm run go-live:load-safe
```

Untuk memeriksa login tiga role tanpa mengubah data akademik:

```bash
TEST_ADMIN_EMAIL='admin-uji@sekolah.test' \
TEST_ADMIN_PASSWORD='kata-sandi-admin' \
TEST_GURU_EMAIL='guru-uji@sekolah.test' \
TEST_GURU_PASSWORD='kata-sandi-guru' \
TEST_STUDENT_NIS='NIS-UJI' \
TEST_STUDENT_PASSWORD='kata-sandi-siswa' \
npm run go-live:roles
```

Credential di atas harus diberikan lewat terminal atau secret manager. Jangan
menuliskannya ke file yang akan di-commit.

## Simulasi ujian wajib

Gunakan data khusus uji:

1. Admin memastikan tahun ajaran, kelas, siswa, guru, dan mata pelajaran benar.
2. Guru membuat bank soal kecil berisi minimal satu pilihan ganda dan satu
   essay.
3. Guru membuat ujian untuk akun siswa uji, menerbitkannya, lalu memastikan
   jadwal muncul pada dashboard siswa tanpa logout.
4. Siswa mulai ujian dan menjawab beberapa soal.
5. Matikan jaringan selama satu jawaban, lalu nyalakan kembali. Pastikan
   indikator jawaban belum tersinkron kembali menjadi nol.
6. Muat ulang halaman ujian dan pastikan jawaban tersimpan.
7. Kumpulkan ujian. Pastikan attempt tidak dapat dikumpulkan dua kali.
8. Guru mengoreksi essay hingga status nilai final.
9. Admin/Guru membuka laporan dan memastikan nilai sesuai bobot.

Data simulasi harus diberi nama jelas seperti `[UJI SISTEM]` agar tidak tertukar
dengan data resmi.

## Operasi pada hari ujian

- Buka dashboard Supabase, hosting, dan halaman **Error aplikasi** sebelum siswa
  mulai.
- Jangan deploy web, Edge Function, atau migrasi selama sesi ujian berjalan,
  kecuali untuk pemulihan insiden kritis.
- Minta siswa tidak membersihkan data browser, menutup paksa aplikasi, atau
  memasang ulang aplikasi ketika jawaban belum tersinkron.
- Jika internet siswa putus, biarkan halaman tetap terbuka. Setelah koneksi
  kembali, tunggu sampai indikator sinkronisasi bersih sebelum mengumpulkan.
- Catat waktu, NIS, ujian, perangkat, dan pesan error untuk setiap insiden.

## Respons insiden

### Website tidak dapat dibuka

1. Periksa domain utama dengan `npm run go-live:check`.
2. Bila hanya satu hosting gagal, bagikan domain cadangan yang sudah lulus
   pemeriksaan.
3. Jangan mengubah database untuk insiden hosting statis.

### Login gagal

1. Pastikan pengguna memakai NIS untuk siswa dan email untuk staf.
2. Pastikan akun aktif dan kata sandi minimal delapan karakter.
3. Jalankan `npm run go-live:check` untuk memeriksa Auth, Edge Function, dan
   origin.
4. Jangan mereset massal kata sandi. Uji satu akun khusus terlebih dahulu.

### Jawaban belum tersinkron

1. Jangan tutup halaman atau membersihkan penyimpanan browser.
2. Pulihkan jaringan dan tunggu proses retry.
3. Pastikan indikator jawaban belum tersinkron menjadi nol.
4. Bila tetap gagal, catat perangkat dan pesan error lalu pindahkan siswa ke
   jaringan stabil tanpa menghapus data browser.

### Nilai belum final

Ujian yang memiliki essay memang masuk antrean koreksi. Guru harus menilai
seluruh essay; status final baru muncul setelah semua essay memperoleh skor.

## Rollback

Untuk masalah frontend, gunakan fitur rollback/redeploy pada hosting ke commit
stabil yang dicatat sebelum rilis. Setelah rollback, ulangi
`npm run go-live:check`.

Untuk masalah database:

- jangan menghapus migration yang sudah diterapkan;
- jangan menjalankan SQL rollback improvisasi saat ujian berlangsung;
- hentikan perubahan data terkait, kumpulkan bukti error, dan pilih forward-fix
  melalui migration baru;
- pemulihan dari backup hanya dilakukan jika kerusakan data sudah
  terkonfirmasi dan dampaknya dipahami.

## Catatan hasil

Isi sebelum membuka akses:

- Commit web: ______________________________
- Migration remote terakhir: ______________
- Deployment utama: _______________________
- Waktu pemeriksaan: _______________________
- Operator teknis: _________________________
- Hasil simulasi tiga role: LULUS / GAGAL
- Keputusan: GO / NO-GO
