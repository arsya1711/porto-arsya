# Bug Report Hasil Pengujian — Ruang Ujian

| Atribut | Nilai |
|---|---|
| Tanggal pengujian | 17 Juli 2026 |
| Environment | Local build/preview dan production `porto-arsya.pages.dev` |
| Referensi | `TEST_PLAN_PRODUCTION.md`, `TEST_CASES_PRODUCTION.md`, `TEST_SCENARIO_DAN_CASE_AUDIT.md` |
| Status release | **NO-GO** |
| Perubahan aplikasi | Tidak ada fix kode/schema yang dilakukan |

## 1. Ringkasan eksekusi

### PASS

- `npm run lint` selesai dengan exit code 0.
- `npm run build` selesai dengan exit code 0.
- `npm audit --audit-level=low` menemukan 0 vulnerability.
- Build tanpa env Supabase menampilkan halaman `Konfigurasi server belum tersedia` dan tidak menampilkan dashboard/data contoh.
- Local preview merender landing page pada `/`, `/app/ujian`, dan `/siswa` tanpa blank screen.
- Production mengembalikan HTTP 200 dan SPA shell untuk `/`, `/app`, `/app/ujian`, dan `/siswa`.
- Tabel utama Supabase tersedia melalui endpoint read-only dengan HTTP 200.

### FAIL

- Signup Auth production masih aktif (`disable_signup=false`).
- Policy siswa dapat mengembalikan seluruh row `exams`, termasuk kolom `access_code`.
- Policy siswa pada `answers` tidak membatasi kolom `score` dan `teacher_comment`.
- UI aktif create/update exam tidak menggunakan RPC atomik.
- UI aktif grading essay melakukan update langsung ke tabel dan update attempt terpisah.
- Shuffle/fullscreen/tab-switch configuration belum diterapkan penuh oleh runner aktif.
- Laporan item analysis tidak memfilter attempt berjalan dan bucket skor tidak memasukkan 100.
- Security headers production belum memiliki CSP, HSTS, frame protection, dan Permissions-Policy.
- Cloudflare masih menyajikan `/src/main.tsx` dari cache sebagai source file lama.
- README dan test plan masih menyebut migration `001–010`, sedangkan schema sudah `001–012`.

### BLOCKED

Case berikut tidak dapat dieksekusi end-to-end karena tidak tersedia environment staging dan akun QA terautentikasi dengan data sintetis:

- Login/logout/reset password untuk setiap role.
- RLS lintas siswa/guru/admin menggunakan JWT masing-masing.
- Create user, update user, dan class membership melalui Edge Function.
- Create exam dan grading dengan transaksi nyata.
- Autosave, timeout, submit, concurrency, dan recovery menggunakan attempt QA.
- Backup/restore serta rollback deployment Cloudflare.
- Matriks browser/perangkat dan load test.

`Blocked` bukan berarti lulus; case harus diulang pada staging sebelum release.

## 2. Detail bug

### BUG-AUD-001 — Signup publik memungkinkan role istimewa

| Field | Detail |
|---|---|
| Priority/Severity | **P0 / S0** |
| Area | Auth, profile provisioning |
| Test case | `AUD-SEC-001`, `AUTH-001`, `SCR-007` |
| Status | Open — Fail (configuration/source evidence) |
| Evidence | Auth settings production: `disable_signup=false`; `supabase/migrations/002_auth_user_management.sql:28-40` |

**Langkah reproduksi:**

1. Buka konfigurasi Auth project production dan lihat `disable_signup`.
2. Kirim signup dengan metadata `role=admin` menggunakan akun QA disposable pada staging.
3. Baca row profile yang dibuat.

**Expected:** Signup publik ditolak, atau user baru selalu menjadi `siswa`.  
**Actual:** Signup publik aktif dan trigger menerima role dari metadata user.  
**Dampak:** User tidak berwenang berpotensi mendapatkan akses admin/guru.  
**Catatan:** Signup eksploitasi tidak dijalankan pada production untuk menghindari pembuatan akun nyata; konfigurasi dan source sudah cukup membuktikan defect.

### BUG-AUD-002 — Siswa dapat membaca access code dari row exams

| Field | Detail |
|---|---|
| Priority/Severity | **P0 / S0** |
| Area | RLS, exam access |
| Test case | `AUD-SEC-004`, `AUD-SEC-005`, `ATT-002` |
| Status | Open — Fail (policy evidence; runtime JWT test Blocked) |
| Evidence | `supabase/migrations/001_initial_schema.sql:90` |

**Langkah reproduksi:**

1. Login sebagai siswa yang ditugaskan ke ujian berkode.
2. Jalankan query REST/SDK `exams?select=id,access_code`.
3. Bandingkan dengan kode yang digunakan pada `start_exam_attempt`.

**Expected:** Siswa tidak pernah menerima `access_code`; kode hanya dibandingkan di server.  
**Actual:** Policy SELECT siswa berlaku untuk seluruh row `exams`, termasuk `access_code`.  
**Dampak:** Kode akses dapat diambil sebelum siswa memulai ujian dan dapat dibagikan ke peserta lain.

### BUG-AUD-003 — Siswa dapat mengirim score dan teacher_comment

| Field | Detail |
|---|---|
| Priority/Severity | **P0 / S0** |
| Area | RLS, scoring |
| Test case | `AUD-SEC-007`, `AUD-SEC-008`, `SCR-007` |
| Status | Open — Fail (policy evidence; runtime JWT test Blocked) |
| Evidence | `supabase/migrations/009_exam_access_hardening.sql:29-69` |

**Langkah reproduksi:**

1. Login sebagai siswa dengan attempt `in_progress`.
2. Upsert row `answers` dengan `score=100` dan `teacher_comment='QA'`.
3. Baca row dan submit attempt.

**Expected:** Siswa hanya dapat menulis pilihan/jawaban essay; score dan comment tetap server-controlled.  
**Actual:** Policy update hanya memeriksa ownership, status, dan waktu; tidak ada pembatasan kolom.  
**Dampak:** Nilai essay dan nilai akhir dapat dimanipulasi oleh siswa.

### BUG-AUD-004 — Create/update exam melewati RPC atomik

| Field | Detail |
|---|---|
| Priority/Severity | **P0 / S0** |
| Area | Exam management, transactions, authorization |
| Test case | `AUD-EXM-001`–`AUD-EXM-004`, `EXM-001`–`EXM-016` |
| Status | Open — Fail (source evidence; staging transaction test Blocked) |
| Evidence | `src/components/AssessmentPages.tsx:322-388`; RPC tersedia di `supabase/migrations/010_atomic_exam_creation.sql` |

**Langkah reproduksi:**

1. Login sebagai guru.
2. Buat atau edit ujian dari `/app/ujian`.
3. Putus koneksi setelah exam tersimpan tetapi sebelum relasi soal/assignment selesai, atau kirim question/class ID tidak valid melalui Network replay.

**Expected:** Satu RPC memvalidasi ownership dan menyimpan seluruh perubahan dalam satu transaksi; kegagalan melakukan rollback penuh.  
**Actual:** UI melakukan insert/update exam, delete relasi lama, insert soal, query class members, lalu insert assignment secara terpisah.  
**Dampak:** Orphan/partial exam, assignment salah, dan validasi server dapat dilewati melalui direct API.

### BUG-AUD-005 — Grading essay melakukan update client-side dan tidak atomic

| Field | Detail |
|---|---|
| Priority/Severity | **P0 / S1** |
| Area | Grading, scoring |
| Test case | `AUD-GRD-001`–`AUD-GRD-003`, `GRD-*` |
| Status | Open — Fail (source evidence; runtime concurrency test Blocked) |
| Evidence | Active grading code di `src/components/AssessmentPages.tsx`; RPC `grade_essay_answer` tersedia tetapi tidak dipakai oleh route aktif |

**Langkah reproduksi:**

1. Login sebagai guru dan buka `/app/koreksi`.
2. Simpan nilai essay.
3. Amati Network request dan jalankan dua save bersamaan.

**Expected:** RPC server memvalidasi ownership, batas score, update answer, dan recompute attempt dalam satu transaksi.  
**Actual:** Client update answer lalu query beberapa tabel dan update attempt secara terpisah; error update attempt terakhir tidak menjadi kegagalan operasi utama.  
**Dampak:** Nilai answer dan nilai akhir dapat tidak konsisten atau tertimpa oleh race condition.

### BUG-AUD-006 — Jawaban lokal dapat tertimpa saat runner selesai load

| Field | Detail |
|---|---|
| Priority/Severity | **P1 / S1** |
| Area | Student runner, autosave/recovery |
| Test case | `AUD-RUN-001`, `RUN-003`, `RUN-004` |
| Status | Open — Fail (source evidence) |
| Evidence | `src/App.tsx:2592-2594` dan `src/App.tsx:2685-2688` |

**Langkah reproduksi:**

1. Mulai ujian dan jawab soal ketika request autosave gagal/terlambat.
2. Refresh sebelum jawaban lokal tersinkron.
3. Tunggu load server selesai.

**Expected:** Jawaban lokal terbaru dipertahankan dan masuk antrean sinkronisasi.  
**Actual:** `setAnswers(...)` dari server menggantikan state yang sebelumnya diisi dari local cache.  
**Dampak:** Jawaban siswa dapat hilang pada refresh atau gangguan jaringan.

### BUG-AUD-007 — Konfigurasi shuffle/fullscreen/tab switch tidak ditegakkan runner

| Field | Detail |
|---|---|
| Priority/Severity | **P1 / S1** |
| Area | Student runner, integrity |
| Test case | `AUD-RUN-003`, `AUD-RUN-004` |
| Status | Open — Fail (source evidence) |
| Evidence | Setting disimpan di `src/components/AssessmentPages.tsx:225,338-343`; runner aktif di `src/App.tsx:2623-2708` tidak memuat/menerapkan seluruh setting |

**Langkah reproduksi:**

1. Buat ujian dengan shuffle, fullscreen, dan record tab switch masing-masing true/false.
2. Mulai ujian dengan akun siswa QA.
3. Bandingkan urutan soal, Fullscreen API, dan row `integrity_events`.

**Expected:** Perilaku runner mengikuti konfigurasi ujian.  
**Actual:** SQL `get_exam_questions` mengurutkan `position`; runner tidak meminta fullscreen dan mencatat `tab_hidden` tanpa memeriksa setting ujian.  
**Dampak:** Kontrol integritas yang ditawarkan UI tidak sesuai perilaku nyata.

### BUG-AUD-008 — Item analysis memasukkan attempt berjalan dan skor 100 tidak masuk bucket

| Field | Detail |
|---|---|
| Priority/Severity | **P1 / S2** |
| Area | Reports, analytics |
| Test case | `AUD-RPT-001`, `AUD-RPT-002`, `RPT-*` |
| Status | Open — Fail (source evidence; data fixture test Blocked) |
| Evidence | Query analisis aktif di `src/components/AssessmentPages.tsx`; bucket menggunakan batas `< (index+1)*10` |

**Langkah reproduksi:**

1. Siapkan satu attempt `in_progress` dan satu `final` pada ujian yang sama.
2. Buka `/app/laporan` dan lihat analisis butir.
3. Tambahkan skor 100 dan lihat distribusi.

**Expected:** Hanya status yang disepakati bisnis (`submitted`/`final`) dihitung; score 100 masuk bucket tertinggi.  
**Actual:** Query answer item analysis tidak memfilter status attempt; bucket terakhir berhenti sebelum 100.  
**Dampak:** Statistik dan keputusan evaluasi sekolah menjadi salah.

### BUG-AUD-009 — Perubahan penting tidak seluruhnya tercatat di audit log

| Field | Detail |
|---|---|
| Priority/Severity | **P1 / S1** |
| Area | Audit, compliance |
| Test case | `AUD-EXM-004`, `AUD-ADM-003` |
| Status | Open — Fail (source/migration evidence; runtime test Blocked) |
| Evidence | Audit trigger hanya mencakup sebagian master data; active exam/grading/settings flow tidak konsisten memanggil audit logger |

**Langkah reproduksi:** Buat/update/delete ujian, relasi soal, assignment, grading, dan settings; query `audit_logs` berdasarkan actor/time window.

**Expected:** Setiap perubahan memiliki actor, action, entity, entity ID, metadata, dan timestamp.  
**Actual:** Sebagian perubahan melalui direct table write tidak memiliki audit event yang konsisten.  
**Dampak:** Investigasi perubahan nilai/ujian tidak memiliki jejak lengkap.

### BUG-AUD-010 — Update user Edge Function tidak atomic

| Field | Detail |
|---|---|
| Priority/Severity | **P1 / S1** |
| Area | Admin user management |
| Test case | `AUD-ADM-001`, `ADM-001` |
| Status | Open — Fail (source evidence; fault-injection test Blocked) |
| Evidence | `supabase/functions/admin-users/index.ts:64-84` |

**Langkah reproduksi:**

1. Update Auth user lalu paksa kegagalan update profile/class membership.
2. Baca Auth user, profile, dan membership.

**Expected:** Semua perubahan commit bersama atau dikompensasi dengan jelas.  
**Actual:** Auth update terjadi lebih dahulu; kegagalan berikutnya dapat meninggalkan state berbeda antar tabel.

### BUG-AUD-011 — Security headers production tidak lengkap

| Field | Detail |
|---|---|
| Priority/Severity | **P1 / S1** |
| Area | Cloudflare deployment |
| Test case | `AUD-DEP-002`, `SEC-010`, `SEC-011` |
| Status | Open — Fail (production HTTP evidence) |
| Evidence | `curl -I https://porto-arsya.pages.dev/` hanya menunjukkan `referrer-policy` dan `x-content-type-options`; tidak ada CSP, HSTS, frame protection, atau Permissions-Policy |

**Langkah reproduksi:**

```bash
curl -I https://porto-arsya.pages.dev/
```

**Expected:** Header hardening tersedia dan sesuai threat model aplikasi.  
**Actual:** Header utama belum diset.  
**Dampak:** Risiko clickjacking, policy injection, dan transport downgrade meningkat.

### BUG-AUD-012 — Source file lama tersaji dari Cloudflare cache

| Field | Detail |
|---|---|
| Priority/Severity | **P1 / S1** |
| Area | Cloudflare cache/deployment |
| Test case | `AUD-DEP-003`, `SEC-012` |
| Status | Open — Fail (production HTTP evidence) |
| Evidence | `GET /src/main.tsx` mengembalikan HTTP 200, `content-type: application/octet-stream`, `cf-cache-status: HIT`, `age` ribuan detik, dan isi source React |

**Langkah reproduksi:**

```bash
curl -i https://porto-arsya.pages.dev/src/main.tsx
```

**Expected:** Hanya asset hasil build yang tersedia; source path tidak boleh tersaji sebagai artefak deployment lama.  
**Actual:** Source lama masih dapat diakses dari cache.  
**Dampak:** Membocorkan struktur internal aplikasi dan dapat membuat browser menerima artefak yang tidak sesuai deployment terbaru.

### BUG-AUD-013 — Navigasi mobile tidak mencakup semua section role

| Field | Detail |
|---|---|
| Priority/Severity | **P1 / S2** |
| Area | Responsive/mobile UX |
| Test case | `AUD-UX-001`, `COMP-*` |
| Status | Open — Fail (source/CSS evidence; device test Blocked) |
| Evidence | `styles-runner.css` menampilkan mobile nav, tetapi menu role tertentu tidak memuat koreksi, laporan, settings, atau master data secara lengkap; tombol `mobile-menu` tidak memiliki handler lengkap |

**Langkah reproduksi:** Buka aplikasi pada viewport 360×800 sebagai admin dan guru; gunakan hanya menu mobile.

**Expected:** Semua section yang diizinkan role dapat dijangkau tanpa mengetik URL manual.  
**Actual:** Beberapa section tidak tersedia pada navigasi mobile.

### BUG-AUD-014 — Dokumentasi migration dan settings tidak sinkron

| Field | Detail |
|---|---|
| Priority/Severity | **P1 / S2** |
| Area | Documentation/release process |
| Test case | `AUD-DOC-001`, `AUD-DOC-002`, `MIG-*`, `SET-001` |
| Status | Open — Fail (repository evidence) |
| Evidence | `README.md:99`, `docs/TEST_PLAN_PRODUCTION.md:21,53,86,205`, dan `docs/TEST_CASES_PRODUCTION.md:131` masih menyebut `001–010`; implementasi aktif memakai `school_profile_settings` dari migration `011/012` |

**Langkah reproduksi:** Ikuti deployment checklist secara literal pada database baru.

**Expected:** Semua migration yang diperlukan (`001–012`) dan tabel settings aktif dijelaskan.  
**Actual:** Operator dapat berhenti di migration `010` atau menguji tabel `school_settings` yang bukan tabel aktif.

## 3. Matriks status test utama

| Kelompok | Status | Keterangan |
|---|---|---|
| Build/config/local preview | PASS | Lint, build, audit dependency, fail-safe tanpa env, dan local preview berhasil |
| Production smoke/deep-link | PASS | Route utama mengembalikan SPA shell dan tidak blank screen |
| Production security/header/cache | FAIL | Header hardening dan source/cache exposure terbukti bermasalah |
| Auth/RLS runtime dengan JWT QA | FAIL/BLOCKED | Signup config/policy bermasalah; runtime lintas role menunggu akun QA |
| Exam/grading/runner runtime | FAIL/BLOCKED | Defect kritis terbukti dari source; transaksi nyata menunggu staging |
| Reports/admin/mobile runtime | FAIL/BLOCKED | Defect source terdokumentasi; device/fault-injection test belum tersedia |
| Migration upgrade/backup/rollback | FAIL/BLOCKED | Dokumentasi mismatch; upgrade/restore/rollback memerlukan environment khusus |

`FAIL` berarti defect sudah dapat dibuktikan dari source/configuration atau production response. `BLOCKED` berarti runtime confirmation membutuhkan environment/credential yang belum tersedia.

## 4. Release decision

**NO-GO.** Jangan gunakan production untuk ujian resmi sebelum seluruh bug P0 ditutup, case P0 diulang dengan akun QA staging, dan evidence disetujui QA Lead/Product Owner.

## 5. Rekomendasi tindak lanjut (tanpa implementasi)

1. Sediakan project Supabase staging terpisah dan akun QA sintetis sesuai test plan.
2. Jalankan ulang seluruh case `AUD-*` yang saat ini `Blocked`.
3. Prioritaskan BUG-AUD-001 sampai BUG-AUD-005 sebelum test UAT.
4. Simpan response, screenshot, request ID, dan query evidence untuk setiap case.
5. Setelah perbaikan dikerjakan oleh tim developer, ulangi suite ini sebagai regression test; jangan mengubah status bug menjadi Pass hanya karena source sudah berubah.
