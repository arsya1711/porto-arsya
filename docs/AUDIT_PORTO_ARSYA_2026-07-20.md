# Audit dan Remediasi Porto Arsya — 20 Juli 2026

## Status

Audit dilakukan pada source React/TypeScript, migration Supabase, Edge Function,
konfigurasi deployment, dan repository Git. Build, lint, test kontrak, serta
audit dependency harus lulus sebelum deployment.

## Perbaikan yang diterapkan

- Jawaban esai disinkronkan menjelang timeout dan seluruh jawaban diperiksa
  kembali sebelum attempt dikumpulkan.
- Migration `015_exam_security_and_branding.sql` memindahkan kode akses ujian
  dari plaintext ke hash bcrypt, menambahkan pembatas delapan percobaan per 15
  menit, dan menyamakan batas waktu pengambilan soal dengan deadline attempt.
- Event integritas hanya dapat dicatat untuk attempt aktif yang memang
  mengaktifkan pencatatan.
- Perubahan profil dan kelas pengguna diproses dalam satu transaksi database.
  Edge Function mengembalikan perubahan Auth jika transaksi profil gagal.
- Rate limit login siswa menggunakan reservasi atomik sehingga request paralel
  ikut dihitung.
- CORS Edge Function dibatasi menggunakan secret `APP_ORIGIN` dan respons yang
  memuat session diberi `Cache-Control: no-store`.
- Halaman audit menampilkan detail 100 event integritas terbaru.
- Nama awal sekolah diselaraskan menjadi `Mts Alhidayah Wattaqwa` dan teks
  sambutan login yang tersisa dihapus.
- CI, test kontrak repository, dan pemeriksaan Deno Edge Function ditambahkan.

## Langkah deployment wajib

1. Terapkan migration `015_exam_security_and_branding.sql` setelah migration
   `014_student_exam_contract.sql` pada staging, lalu production.
2. Isi secret `APP_ORIGIN` pada Supabase. Nilainya dapat berupa beberapa origin
   yang dipisahkan koma.
3. Deploy ulang Edge Function `admin-users` dan `student-login`.
4. Pastikan public signup Supabase Auth nonaktif, Redirect URL benar, backup
   database aktif, dan log Edge Function dipantau.
5. Jalankan smoke test dengan akun admin, guru, dan siswa sebelum ujian nyata.

Status penerapan migration dan Edge Function production tidak dapat dipastikan
hanya dari repository; pemeriksaan tersebut harus dilakukan pada project
Supabase tujuan.
