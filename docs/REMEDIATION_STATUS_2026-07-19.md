# Status Remediasi Audit — AWExam

| Atribut | Nilai |
|---|---|
| Tanggal | 19 Juli 2026 |
| Basis audit | `BUG_REPORT_AUDIT_2026-07-17.md` |
| Cakupan | Perubahan source lokal, migration, dan pemeriksaan statis |
| Status release | **NO-GO sampai staging selesai** |

Dokumen audit 17 Juli dipertahankan sebagai hasil pengujian historis. Status `Fixed in source` di bawah belum berarti `PASS production`; migration, Edge Function, konfigurasi Auth, dan deployment harus diverifikasi pada staging dengan akun tiga role.

## Sudah diperbaiki di source

- Trigger akun baru selalu membuat role `siswa`; metadata signup tidak dapat memilih admin/guru.
- Siswa tidak lagi membaca tabel `exams` secara langsung; katalog ujian aman diberikan melalui RPC tanpa `access_code`.
- Penulisan jawaban siswa menjadi RPC-only dan selalu mengosongkan score/comment dari input klien.
- Create/update/delete ujian serta grading essay menggunakan RPC atomik dan audit log.
- Hak mutasi langsung guru pada ujian, relasi soal, assignment, answer, dan attempt telah ditutup.
- Katalog, start attempt, deadline, autosave, submit, serta recovery jawaban digunakan oleh web dan Flutter.
- Shuffle soal dan opsi bersifat deterministik per attempt; indeks jawaban diterjemahkan kembali oleh server untuk scoring dan recovery.
- Soal yang masuk ujian terjadwal atau sudah memiliki attempt tidak dapat diubah isinya.
- Scope baca guru untuk profil, kelas, dan anggota kelas dibatasi pada kelas penugasan.
- Fullscreen dan pencatatan perpindahan tab mengikuti konfigurasi ujian.
- Integrity event membatasi actor, tipe event, dan ukuran metadata.
- Login NIS memiliki rate limit persisten 15 menit berbasis hash NIS/IP tanpa menyimpan identitas mentah.
- Item analysis mengecualikan attempt berjalan, nilai 100 masuk bucket tertinggi, dan KKM berasal dari pengaturan.
- Header hardening dan cache policy tersedia melalui `public/_headers` untuk hosting yang mendukung format tersebut.
- Menu mobile membuka drawer navigasi lengkap; implementasi runner lama yang tidak aman dihapus.
- Migration dan dokumentasi diperbarui sampai `014_student_exam_contract.sql`.

## Hasil pemeriksaan lokal

- `npm run build`: PASS.
- `npm run lint`: PASS.
- `npm audit`: PASS, 0 vulnerability.
- `flutter analyze`: PASS.
- `flutter test`: PASS, 7 test.
- `flutter build web`: PASS.
- `flutter build apk --debug`: PASS.
- Secret pattern scan source: tidak menemukan service-role key atau JWT yang tertanam.

## Masih wajib sebelum go-live

1. Aktifkan Docker/Postgres lokal atau gunakan project staging, lalu terapkan migration `001`–`014` pada database kosong dan database upgrade.
2. Perbaiki NIS duplikat bila preflight migration `014` menolak data, kemudian ulangi migration.
3. Deploy ulang Edge Function `admin-users` dan `student-login` ke staging.
4. Nonaktifkan public signup pada Supabase Auth dan verifikasi nilai konfigurasi secara langsung.
5. Verifikasi dan tune rate limit login NIS di staging; tambahkan CAPTCHA/WAF bila diperlukan serta perlindungan brute-force khusus kode akses ujian.
6. Jalankan test RLS menggunakan JWT admin, guru, dua siswa berbeda, dan guru tanpa assignment.
7. Jalankan E2E create exam → start → autosave/reload → timeout/submit → grading → report.
8. Uji fault injection Edge Function update user; operasi Auth dan database masih melintasi dua layanan sehingga perlu verifikasi kompensasi operasional.
9. Putuskan kebijakan penyimpanan access code. Saat ini nilainya tidak dikirim ke siswa, tetapi masih plaintext pada tabel dan terlihat oleh guru pemilik ujian.
10. Deploy web, purge cache Cloudflare, pastikan `/src/main.tsx` tidak lagi tersedia, lalu cek CSP/HSTS/frame/permissions headers dari domain production.
11. Jalankan matriks browser/perangkat, accessibility pass, load test ujian serentak, serta backup/restore drill.
12. Siapkan signing key Android production sebelum membuat APK/AAB release.

## Gate keputusan

Release tetap **NO-GO** sampai langkah 1–7 dan 10 memiliki evidence PASS. Temuan access-code-at-rest, atomicity lintas Auth/database, accessibility, load, dan backup harus diterima secara eksplisit atau ditutup sebelum data ujian resmi digunakan.
