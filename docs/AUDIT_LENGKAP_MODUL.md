# Audit Lengkap Modul dan Section — Ruang Ujian

| Atribut | Nilai |
|---|---|
| Produk | Ruang Ujian Web |
| Tanggal audit | 17 Juli 2026 |
| Cakupan | Frontend, Auth, Supabase, RLS/RPC, deployment, mobile, dokumentasi |
| Status | **NO-GO sementara** |
| Referensi utama | `docs/TEST_PLAN_PRODUCTION.md`, `docs/TEST_CASES_PRODUCTION.md` |

## 1. Ringkasan eksekutif

Audit mencakup seluruh route dan modul aktif: landing page, autentikasi, dashboard, manajemen ujian, bank soal, pengguna, kelas, tahun ajaran, mata pelajaran, audit keamanan, koreksi, laporan, pengaturan, portal siswa, dan runner ujian.

Secara teknis build dan deployment berjalan, tetapi belum layak untuk ujian sekolah sebenarnya. Terdapat empat risiko kritis yang harus ditutup sebelum go-live:

1. Signup publik dapat membuka peluang pembuatan akun dengan role istimewa.
2. Siswa dapat membaca `access_code` dari row ujian yang ditugaskan.
3. Policy jawaban belum mencegah siswa mengubah `score` dan `teacher_comment`.
4. UI aktif untuk membuat ujian dan mengoreksi jawaban melewati RPC aman serta melakukan beberapa operasi database secara terpisah.

## 2. Pemeriksaan yang berhasil

| Area | Hasil | Catatan |
|---|---|---|
| Lint | PASS | `npm run lint` selesai tanpa error/warning |
| Build | PASS | `npm run build` menghasilkan bundle Vite |
| Dependency | PASS | `npm audit --audit-level=low` menemukan 0 vulnerability |
| Production smoke test | PASS | Halaman login dan landing dapat dirender |
| SPA deep-link | PASS | Route seperti `/app/ujian` mengembalikan shell SPA |
| Schema dasar | PASS | Tabel utama Supabase dapat diakses dan tersedia |
| Source secret scan | PASS | Tidak ditemukan service-role key/JWT rahasia pada tracked files |
| Deployment cache | WARNING | `/src/main.tsx` pernah tersaji sebagai source lama; lakukan purge cache |

## 3. Status setiap section dan modul

| Section/modul | Status | Risiko utama |
|---|---|---|
| Landing dan login | PASS dengan catatan | Error boundary hanya logging console; telemetry belum ada |
| Auth dan session | **FAIL P0** | Signup publik dan role dari metadata user |
| Route guard role | PASS sebagian | Harus didukung enforcement database yang lebih ketat |
| Dashboard admin/guru | PASS sebagian | Data profile/class scope guru masih luas |
| Manajemen admin/guru/siswa | FAIL P1 | Update Edge Function belum atomic |
| Kelas dan anggota kelas | FAIL P1 | Scope akses guru masih terlalu luas |
| Tahun ajaran | PASS | Audit trigger tersedia |
| Mata pelajaran | PASS sebagian | Perubahan assignment belum konsisten diaudit |
| Bank soal | FAIL P1 | Soal yang sudah dipakai masih dapat diedit |
| Manajemen ujian | **FAIL P0** | Bypass RPC atomik, validasi assignment, partial write |
| Portal siswa | PASS sebagian | Query assignment berjalan; access code masih terekspos melalui policy |
| Runner ujian | FAIL P1 | Autosave recovery, shuffle, fullscreen, integrity config |
| Koreksi essay | **FAIL P0** | Update client-side dan race condition |
| Laporan dan analisis | FAIL P1 | Attempt berjalan ikut dihitung; bucket nilai 100 salah |
| Audit dan keamanan | FAIL P1 | Coverage log tidak lengkap; event integritas bebas |
| Pengaturan sekolah | PASS sebagian | Modul aktif memakai `school_profile_settings`, test plan masih menyebut `school_settings` |
| Responsive/mobile | FAIL P1 | Mobile menu dan beberapa navigasi tidak lengkap |
| Deployment Cloudflare | PASS dengan warning | Security headers dan cache source perlu diperbaiki |

## 4. Temuan kritis (P0)

### P0-01 — Signup publik dan privilege escalation

Konfigurasi Auth production terdeteksi dengan `disable_signup = false`. Trigger pembuatan profile membaca role dari metadata Auth:

- `supabase/migrations/001_initial_schema.sql:54`
- `supabase/migrations/002_auth_user_management.sql:28-40`

Mitigasi wajib:

- Matikan signup publik pada Supabase Auth.
- Trigger user baru selalu menetapkan role `siswa`.
- Pembuatan admin/guru hanya melalui jalur admin/Edge Function terotorisasi.
- Perbarui instruksi onboarding pada `README.md` agar tidak mengandalkan metadata signup publik.

### P0-02 — Kebocoran access code

Policy `student reads assigned exams` mengizinkan siswa membaca seluruh kolom `exams`, termasuk `access_code`:

- `supabase/migrations/001_initial_schema.sql:90`

Mitigasi wajib:

- Hapus akses SELECT langsung siswa ke row ujian, atau gunakan view/RPC yang tidak mengembalikan `access_code`.
- Validasi kode hanya di server melalui `start_exam_attempt`.
- Tambahkan rate limit/brute-force protection untuk percobaan kode.

### P0-03 — Manipulasi nilai melalui tabel answers

Policy insert/update siswa hanya memeriksa kepemilikan attempt dan waktu aktif; tidak membatasi kolom yang boleh ditulis:

- `supabase/migrations/009_exam_access_hardening.sql:29-69`

Mitigasi wajib:

- Jadikan penulisan jawaban siswa RPC-only, atau cabut privilege update langsung dan berikan RPC khusus.
- Pastikan setiap write siswa selalu mengosongkan `score` dan `teacher_comment`.
- Nilai essay hanya boleh ditulis oleh RPC koreksi guru/admin.

### P0-04 — Alur ujian dan koreksi melewati RPC aman

`RealExamManagement` melakukan insert/update/delete pada beberapa tabel secara berurutan:

- `src/components/AssessmentPages.tsx:322-388`

RPC atomik sudah tersedia di `supabase/migrations/010_atomic_exam_creation.sql`, tetapi belum digunakan oleh route aktif. Modul koreksi aktif juga belum menggunakan RPC `grade_essay_answer` secara konsisten.

Mitigasi wajib:

- Pindahkan create/update/delete ujian ke RPC atomik.
- Validasi kepemilikan mata pelajaran, kelas, bank soal, dan peserta di server.
- Pindahkan grading essay ke `grade_essay_answer`.
- Tambahkan transaksi dan idempotency key untuk operasi submit/grading.

## 5. Temuan penting P1/P2

### Runner dan integritas

- `shuffle_questions` dan `shuffle_options` disimpan tetapi belum diterapkan penuh oleh runner aktif.
- `fullscreen_mode` tidak memicu Fullscreen API.
- `record_tab_switches` tidak dipakai sebagai kondisi sebelum event dicatat.
- Local cache diinisialisasi, tetapi kemudian ditimpa jawaban server pada `src/App.tsx:2685-2688`; ini dapat menghilangkan jawaban yang belum tersinkron.
- Status sinkronisasi belum ditampilkan secara akurat; pesan sukses dapat muncul meskipun persist gagal.
- Tombol submit belum memiliki lock yang kuat terhadap klik berulang.
- Status “ragu” hanya berada di state React dan hilang ketika refresh.
- Implementasi lama `src/components/ExamRunner.tsx` masih ada dan berisi jalur write langsung yang berisiko diaktifkan kembali.

### Laporan dan penilaian

- Analisis butir mengambil jawaban tanpa mengecualikan attempt `in_progress`.
- Distribusi skor menggunakan bucket yang mengecualikan nilai 100 dari bucket terakhir.
- Error query analisis belum ditangani dengan benar.
- KKM masih hardcoded 75.

### RLS, audit, dan privasi

- Guru dapat membaca profile dan daftar class/student terlalu luas dibanding scope assignment.
- Perubahan ujian, relasi soal, assignment, grading, dan settings belum seluruhnya masuk audit log.
- `integrity_events` menerima `event_type` dan metadata bebas tanpa daftar tipe, rate limit, atau batas ukuran.
- `access_code` tersimpan plaintext di tabel `exams`.

### UI, mobile, dan deployment

- Mobile bottom navigation belum memuat seluruh section penting.
- Tombol menu mobile pada beberapa layout belum memiliki handler yang berfungsi penuh.
- Banyak tombol ikon membutuhkan `aria-label`.
- Header production belum memiliki CSP, HSTS, `frame-ancestors`/X-Frame-Options, dan Permissions-Policy.
- Purge cache Cloudflare diperlukan untuk menghapus artefak source lama.

## 6. Pemetaan terhadap test plan

| Test case | Status audit |
|---|---|
| CFG-003 lint/build | PASS |
| CFG-009 deep route fallback | PASS |
| SCR-007 score manipulation | **FAIL** |
| EXM-001 s.d. EXM-016 | **FAIL sebagian besar** karena UI aktif tidak memakai RPC atomik |
| RUN-006/RUN-007 local cache dan recovery | **FAIL** |
| RUN-019 integrity event dengan student identity | **FAIL** |
| GRD secure grading dan race safety | **FAIL** |
| RPT item analysis dan score distribution | **FAIL sebagian** |
| SEC-010/SEC-011 security headers | **FAIL** |
| SEC-015/SEC-016 brute-force/rate limit | Belum terpenuhi |
| SET-001 school settings | Spec tidak sinkron dengan implementasi aktif |

Dokumen test plan juga masih menyebut migration `001–010`, sedangkan repository sudah memiliki migration `011` dan `012`.

## 7. Urutan remediation yang disarankan

### Fase 1 — Security blocker

1. Matikan signup publik.
2. Kunci role profile agar tidak dapat dipilih dari metadata publik.
3. Tutup akses langsung siswa ke `access_code`.
4. Jadikan write jawaban siswa RPC-only dan lindungi kolom nilai.
5. Pastikan semua RPC `SECURITY DEFINER` memiliki `search_path` tetap dan validasi actor.

### Fase 2 — Integritas transaksi

1. Hubungkan UI manajemen ujian ke RPC atomik.
2. Hubungkan koreksi essay ke RPC grading.
3. Tambahkan idempotency dan lock untuk save/submit/grading.
4. Tambahkan test RLS lintas role dan lintas kelas.

### Fase 3 — Runner dan reporting

1. Perbaiki recovery local cache tanpa menimpa jawaban lokal yang lebih baru.
2. Terapkan shuffle, fullscreen, dan konfigurasi integrity event.
3. Persist status ragu.
4. Filter laporan hanya pada attempt final/submitted sesuai kebutuhan bisnis.
5. Perbaiki bucket skor 100 dan hilangkan KKM hardcoded.

### Fase 4 — Release hardening

1. Tambahkan security headers Cloudflare.
2. Purge cache setelah deployment.
3. Lengkapi mobile navigation dan accessibility labels.
4. Perbarui README serta test plan untuk migration `001–012`.
5. Tambahkan automated E2E/security regression suite.

## 8. Keputusan audit

**Keputusan saat ini: NO-GO untuk ujian sekolah nyata.**

Build dan deployment boleh digunakan untuk staging/UAT, tetapi production belum boleh menerima data ujian resmi sampai seluruh temuan P0 ditutup dan test case `SCR-007`, `EXM-001`–`EXM-016`, `RUN-006`/`RUN-007`, `RUN-019`, serta kelompok `GRD` dan `SEC` yang terkait dinyatakan PASS dengan evidence.

Tidak ada perubahan kode yang dilakukan sebagai bagian dari audit ini.
