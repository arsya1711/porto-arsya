# Test Scenario dan Test Case Audit — AWExam

Dokumen ini adalah suite regression/security tambahan berdasarkan temuan pada [`AUDIT_LENGKAP_MODUL.md`](./AUDIT_LENGKAP_MODUL.md). Dokumen ini melengkapi, bukan menggantikan, [`TEST_CASES_PRODUCTION.md`](./TEST_CASES_PRODUCTION.md).

| Atribut | Nilai |
|---|---|
| Status seluruh case | Not Run |
| Target | Staging sebelum go-live |
| Tanggal dibuat | 17 Juli 2026 |
| Data | Sintetis dengan prefix `QA-` |
| Aturan | Satu expected result gagal = case Fail |

## 1. Status dan evidence

Gunakan status berikut: `Not Run`, `Pass`, `Fail`, `Blocked`, atau `Not Applicable`.

Untuk setiap eksekusi, catat:

```text
Case ID:
Build/Commit SHA:
Migration terakhir:
Environment:
Tanggal/Waktu WIB:
Tester:
Browser/Perangkat:
Akun/Role:
Status:
Actual result:
Evidence URL/Screenshot:
Request ID/Log:
Defect ID:
Cleanup:
```

## 2. Data uji minimum

| Alias | Data |
|---|---|
| ADMIN_A | Admin aktif |
| ADMIN_B | Admin aktif kedua |
| TEACHER_A | Guru dengan assignment Matematika/IX A |
| TEACHER_NONE | Guru aktif tanpa assignment |
| STUDENT_A | Siswa aktif, assigned ke ujian QA |
| STUDENT_OTHER | Siswa aktif, bukan peserta ujian QA |
| STUDENT_OFF | Siswa nonaktif |
| CLASS_IXA | Kelas IX A dengan minimal 2 siswa |
| SUBJECT_MATH | Mata pelajaran Matematika |
| BANK_A | Bank soal milik TEACHER_A |
| EXAM_QA | Ujian QA dengan PG dan essay |
| ACCESS_CODE | `QA-IXA-26` |

## 3. Skenario pengujian

| Scenario ID | Area | Tujuan | Case |
|---|---|---|---|
| SCN-SEC-01 | Auth | Mencegah privilege escalation | AUD-SEC-001–003 |
| SCN-SEC-02 | RLS/privacy | Menjamin siswa hanya melihat data yang diperlukan | AUD-SEC-004–006 |
| SCN-SEC-03 | Answer security | Mencegah manipulasi nilai siswa | AUD-SEC-007–009 |
| SCN-EXM-01 | Exam workflow | Menjamin create/update/delete atomik dan terotorisasi | AUD-EXM-001–004 |
| SCN-RUN-01 | Runner | Menjamin jawaban, timer, shuffle, fullscreen, dan submit konsisten | AUD-RUN-001–006 |
| SCN-GRD-01 | Grading | Menjamin koreksi hanya oleh guru/admin yang berwenang | AUD-GRD-001–003 |
| SCN-RPT-01 | Reporting | Menjamin laporan hanya memakai attempt valid | AUD-RPT-001–003 |
| SCN-ADM-01 | Admin/audit | Menjamin perubahan user dan settings konsisten serta tercatat | AUD-ADM-001–003 |
| SCN-UX-01 | Mobile/accessibility | Menjamin semua fungsi penting dapat diakses | AUD-UX-001–003 |
| SCN-DEP-01 | Deployment | Menjamin build, header, cache, dan deep-link aman | AUD-DEP-001–004 |
| SCN-DOC-01 | Migration/docs | Menjamin dokumentasi sesuai schema aktual | AUD-DOC-001–002 |

## 4. Security dan RLS

### AUD-SEC-001 — Signup publik tidak dapat memilih role istimewa

**Priority/Severity:** P0/S0  
**Precondition:** Signup publik dimatikan atau trigger role sudah diperbaiki.

**Langkah:**

1. Dari halaman signup/API Auth, kirim metadata `{"role":"admin"}` menggunakan email QA baru.
2. Jika signup ditolak, simpan response Auth.
3. Jika signup berhasil, query profile menggunakan session user tersebut.

**Expected:** Signup ditolak; atau profile baru selalu memiliki role `siswa`. Tidak boleh ada akun publik dengan role `admin`/`guru`.

**Evidence:** Response Auth, query profile, screenshot konfigurasi Auth.

### AUD-SEC-002 — Pembuatan guru/admin hanya melalui jalur terotorisasi

**Priority/Severity:** P0/S0  
**Precondition:** `ADMIN_A`, `TEACHER_NONE`.

**Langkah:**

1. Login sebagai siswa dan panggil Edge Function `admin-users` untuk membuat guru.
2. Login sebagai guru dan ulangi.
3. Login sebagai admin dan buat guru dengan class assignment valid.

**Expected:** Siswa/guru menerima 401/403; admin berhasil; profile dan Auth user konsisten.

### AUD-SEC-003 — Akun nonaktif dan session lama ditolak

**Priority/Severity:** P0/S1  
**Precondition:** `STUDENT_OFF` dinonaktifkan setelah session dibuat.

**Langkah:** Login, nonaktifkan akun dari admin, refresh halaman, panggil endpoint protected.

**Expected:** Session dibersihkan atau akses protected ditolak; tidak ada data ujian yang tampil.

### AUD-SEC-004 — Access code tidak terbaca melalui REST

**Priority/Severity:** P0/S0  
**Precondition:** `STUDENT_A` assigned ke `EXAM_QA` dengan `ACCESS_CODE`.

**Langkah:** Dengan session siswa, query `exams` melalui REST/SDK dan minta kolom `access_code`.

**Expected:** Query ditolak, `access_code` tidak dikembalikan, atau hanya view aman tanpa kolom tersebut. Kode hanya diverifikasi oleh `start_exam_attempt`.

### AUD-SEC-005 — Siswa lain tidak dapat membaca ujian/soal

**Priority/Severity:** P0/S0  
**Precondition:** `STUDENT_OTHER` tidak assigned.

**Langkah:** Query `exams`, `exam_questions`, `questions`, dan panggil `get_exam_questions(EXAM_QA)`.

**Expected:** Tidak ada metadata ujian/soal yang dapat dibaca; RPC mengembalikan error atau data kosong.

### AUD-SEC-006 — Role tidak dapat mengubah privilege profile

**Priority/Severity:** P0/S0  
**Precondition:** Session siswa dan guru.

**Langkah:** Coba update `profiles.role`, `profiles.active`, dan `profiles.email` milik sendiri maupun user lain.

**Expected:** Semua perubahan privilege ditolak oleh RLS/trigger; hanya admin melalui jalur resmi yang berhasil.

### AUD-SEC-007 — Siswa tidak dapat mengisi score/comment

**Priority/Severity:** P0/S0  
**Precondition:** `STUDENT_A` memiliki attempt `in_progress`.

**Langkah:** Upsert answer dengan `score=100` dan `teacher_comment='QA'`, lalu baca kembali row tersebut.

**Expected:** Write ditolak; atau hanya `selected_option`/`essay_text` yang tersimpan dengan `score` dan `teacher_comment` tetap NULL.

### AUD-SEC-008 — Jawaban terkunci setelah submit

**Priority/Severity:** P0/S0  
**Precondition:** Attempt sudah `submitted`/`final`.

**Langkah:** Coba insert/update/delete answer menggunakan session siswa.

**Expected:** Semua write ditolak dan nilai akhir tidak berubah.

### AUD-SEC-009 — RPC sensitif menegakkan actor dan role

**Priority/Severity:** P0/S1  
**Langkah:** Panggil `start_exam_attempt`, `submit_exam_attempt`, `grade_essay_answer`, dan `create_scheduled_exam` sebagai anon, siswa, guru tidak berwenang, dan admin.

**Expected:** Hanya kombinasi role dan ownership yang valid yang berhasil; tidak ada RPC sensitif yang dapat dipanggil anon.

## 5. Manajemen ujian

### AUD-EXM-001 — Create exam atomik

**Priority/Severity:** P0/S0  
**Precondition:** `TEACHER_A`, `CLASS_IXA`, `BANK_A`, soal valid.

**Langkah:** Buat ujian dari UI dengan judul, jadwal, durasi, kode akses, soal, dan kelas.

**Expected:** Ujian, relasi soal, dan assignment peserta tersimpan seluruhnya atau tidak ada yang tersimpan. Semua validasi dilakukan server-side.

### AUD-EXM-002 — Rollback jika soal/assignment invalid

**Priority/Severity:** P0/S0  
**Langkah:** Kirim request create dengan question ID milik guru lain, question ID tidak ada, atau class ID tidak valid.

**Expected:** RPC menolak seluruh transaksi; tidak ada orphan exam, relasi soal, atau assignment parsial.

### AUD-EXM-003 — Guru hanya dapat memakai assignment miliknya

**Priority/Severity:** P0/S1  
**Precondition:** `TEACHER_NONE` tidak punya assignment.

**Langkah:** Guru tersebut mencoba membuat ujian memakai `SUBJECT_MATH`/`CLASS_IXA` dan mengisi peserta kelas.

**Expected:** Server menolak operasi; UI tidak dapat mengakali dengan mengganti request langsung.

### AUD-EXM-004 — Update/delete ujian memiliki audit trail

**Priority/Severity:** P1/S1  
**Langkah:** Ubah jadwal, soal, peserta, lalu hapus ujian dari UI.

**Expected:** Perubahan atomik, data relasi konsisten, dan setiap operasi tercatat di `audit_logs` dengan actor, entity, action, dan timestamp.

## 6. Runner siswa

### AUD-RUN-001 — Autosave dan recovery tidak menimpa jawaban lokal

**Priority/Severity:** P0/S1  
**Langkah:** Jawab soal saat koneksi diputus, refresh halaman, pulihkan koneksi, lalu buka kembali attempt.

**Expected:** Jawaban lokal terbaru tetap terlihat; antrean tersinkron setelah koneksi pulih; konflik menggunakan aturan timestamp yang jelas.

### AUD-RUN-002 — Autosave hanya menulis kolom yang diizinkan

**Priority/Severity:** P0/S0  
**Langkah:** Simpan PG dan essay melalui runner, lalu inspeksi row `answers`.

**Expected:** Runner hanya menulis `selected_option`, `essay_text`, dan `answered_at`; nilai/comment tetap server-controlled.

### AUD-RUN-003 — Shuffle soal dan pilihan diterapkan

**Priority/Severity:** P1/S1  
**Precondition:** Buat dua ujian dengan konfigurasi shuffle berbeda.

**Langkah:** Mulai masing-masing ujian minimal dua kali dengan data QA.

**Expected:** Urutan sesuai konfigurasi, tetapi mapping jawaban dan scoring tetap benar.

### AUD-RUN-004 — Fullscreen dan tab switch mengikuti konfigurasi

**Priority/Severity:** P1/S1  
**Langkah:** Uji ujian dengan `fullscreen_mode` dan `record_tab_switches` true/false; keluar tab/window.

**Expected:** Fullscreen diminta hanya ketika aktif; event `tab_hidden` hanya dicatat ketika konfigurasi aktif, dengan `attempt_id` dan `student_id` yang benar.

### AUD-RUN-005 — Timer berasal dari server

**Priority/Severity:** P0/S0  
**Langkah:** Ubah jam laptop, buka dua tab, tunggu deadline, dan coba submit setelah waktu berakhir.

**Expected:** Deadline tetap mengikuti server; jawaban tidak dapat disubmit setelah batas yang ditetapkan; timer tidak dapat diperpanjang lewat clock lokal.

### AUD-RUN-006 — Submit idempotent dan terkunci

**Priority/Severity:** P0/S0  
**Langkah:** Klik submit berkali-kali, jalankan dua tab, dan kirim dua request submit paralel.

**Expected:** Hanya satu transisi status yang valid; tidak ada duplikasi atau perubahan nilai setelah submit pertama berhasil.

## 7. Grading

### AUD-GRD-001 — Grading essay memakai RPC aman

**Priority/Severity:** P0/S0  
**Precondition:** Essay attempt milik `TEACHER_A`.

**Langkah:** Nilai essay dari UI, lalu monitor request dan row answer/attempt.

**Expected:** UI memanggil `grade_essay_answer`; score dibatasi bobot; attempt dihitung ulang oleh server.

### AUD-GRD-002 — Guru lain tidak dapat mengoreksi

**Priority/Severity:** P0/S1  
**Precondition:** `TEACHER_NONE` atau guru tanpa assignment.

**Langkah:** Buka attempt dan panggil grading RPC dengan answer ID tersebut.

**Expected:** UI menyembunyikan data atau server menolak 403; tidak ada score/comment berubah.

### AUD-GRD-003 — Grading concurrent tidak merusak nilai akhir

**Priority/Severity:** P0/S1  
**Langkah:** Jalankan dua grading berbeda untuk answer yang sama dan grading answer terakhir secara paralel.

**Expected:** Lock/transaction server menentukan hasil konsisten; attempt final hanya merefleksikan data yang tersimpan.

## 8. Laporan dan dashboard

### AUD-RPT-001 — Laporan mengecualikan attempt berjalan

**Priority/Severity:** P1/S1  
**Precondition:** Satu attempt `in_progress`, satu `submitted`, satu `final`.

**Langkah:** Buka laporan ujian dan bandingkan dengan query database.

**Expected:** Statistik siswa, distribusi, dan analisis butir hanya memakai status yang disepakati bisnis; attempt berjalan tidak mengubah hasil.

### AUD-RPT-002 — Distribusi mencakup skor 0 dan 100

**Priority/Severity:** P1/S2  
**Langkah:** Buat data skor 0, 10, 50, 90, dan 100.

**Expected:** Setiap skor masuk tepat satu bucket; skor 100 masuk bucket paling tinggi.

### AUD-RPT-003 — Error query ditampilkan dan tidak menghasilkan laporan palsu

**Priority/Severity:** P1/S2  
**Langkah:** Simulasikan query Supabase gagal atau timeout saat membuka analisis.

**Expected:** UI menampilkan error/retry; tidak menampilkan angka kosong sebagai laporan valid.

## 9. Admin, settings, dan audit log

### AUD-ADM-001 — Update user atomic

**Priority/Severity:** P1/S1  
**Langkah:** Update nama, role, status aktif, dan class membership; putus koneksi setelah Auth update tetapi sebelum profile update.

**Expected:** Transaksi berhasil seluruhnya atau dikompensasi; Auth dan profile tidak berbeda; class membership tidak hilang sebagian.

### AUD-ADM-002 — Pengaturan sekolah memakai schema aktif

**Priority/Severity:** P1/S2  
**Langkah:** Simpan nama sekolah, logo, fullscreen default, tab switch, dan timeout dari `/app/pengaturan`.

**Expected:** Data tersimpan di `school_profile_settings`; reload menampilkan nilai yang sama; test plan tidak lagi merujuk schema lama tanpa penjelasan.

### AUD-ADM-003 — Audit log lengkap

**Priority/Severity:** P1/S1  
**Langkah:** Buat/update/delete user, soal, ujian, assignment, grading, dan settings.

**Expected:** Setiap perubahan memiliki actor, action, entity, entity ID, metadata minimal, dan timestamp; siswa tidak dapat memalsukan log.

## 10. Mobile, accessibility, dan deployment

### AUD-UX-001 — Navigasi mobile lengkap

**Priority/Severity:** P1/S2  
**Langkah:** Buka portal sebagai admin, guru, dan siswa pada viewport 360×800; gunakan bottom nav dan menu.

**Expected:** Semua section yang diizinkan role dapat dijangkau tanpa URL manual; tidak ada tombol mati/tertutup.

### AUD-UX-002 — Keyboard dan accessible name

**Priority/Severity:** P1/S2  
**Langkah:** Jalankan alur login, membuat soal, membuat ujian, dan submit hanya dengan keyboard; inspeksi tombol ikon memakai accessibility tree.

**Expected:** Focus order logis, focus terlihat, dialog dapat ditutup, dan semua tombol ikon punya accessible name.

### AUD-UX-003 — Error state dan retry

**Priority/Severity:** P1/S2  
**Langkah:** Simulasikan timeout pada setiap halaman data utama.

**Expected:** Loading berhenti, pesan error jelas, tombol retry tersedia, dan tidak ada blank white screen.

### AUD-DEP-001 — Build dan deploy smoke test

**Priority/Severity:** P0/S0  
**Langkah:** Jalankan lint/build, deploy ke staging, buka `/`, `/app`, `/app/ujian`, `/siswa`, dan `/siswa/ujian/EXAM_QA`.

**Expected:** Semua route mengembalikan SPA shell; route protected tetap meminta session; tidak ada console error critical.

### AUD-DEP-002 — Security headers production

**Priority/Severity:** P1/S1  
**Langkah:** Jalankan `curl -I` pada domain production.

**Expected:** Tersedia HSTS, CSP, `X-Content-Type-Options`, frame protection, Referrer-Policy, dan Permissions-Policy yang sesuai.

### AUD-DEP-003 — Source/cache exposure

**Priority/Severity:** P1/S1  
**Langkah:** Request `/src/main.tsx`, `/src/App.tsx`, `.env`, README, dan asset lama setelah deploy baru.

**Expected:** Tidak ada source/config sensitif yang tersaji; hanya asset build yang diperlukan; Cloudflare cache sudah dipurge.

### AUD-DEP-004 — Rollback deployment

**Priority/Severity:** P1/S1  
**Langkah:** Deploy build kandidat, jalankan smoke test, rollback ke deployment sebelumnya, ulangi smoke test.

**Expected:** Rollback dapat dilakukan tanpa mengubah data database dan route kembali stabil.

## 11. Dokumentasi dan migration

### AUD-DOC-001 — Semua migration terdokumentasi

**Priority/Severity:** P1/S2  
**Langkah:** Bandingkan daftar file `supabase/migrations` dengan README, test plan, dan deployment checklist.

**Expected:** Migration `001` sampai `014` tercantum berurutan; tidak ada instruksi yang berhenti sebelum migration terbaru.

### AUD-DOC-002 — Test plan sinkron dengan implementasi

**Priority/Severity:** P1/S2  
**Langkah:** Cocokkan nama tabel settings, nama RPC, route aktif, dan role yang diuji.

**Expected:** Test plan menyebut `school_profile_settings`, RPC aktif, route aktif, dan expected behavior yang benar.

## 12. Exit criteria

Release hanya dapat diberi status **GO** apabila:

- Semua case P0 berstatus `Pass`.
- Tidak ada defect S0/S1 terbuka.
- `AUD-SEC-001` sampai `AUD-SEC-009` lulus.
- `AUD-EXM-001` sampai `AUD-EXM-004` lulus.
- `AUD-RUN-001`, `AUD-RUN-002`, `AUD-RUN-005`, dan `AUD-RUN-006` lulus.
- `AUD-GRD-001` sampai `AUD-GRD-003` lulus.
- Backup dan rollback deployment sudah diuji.
- Evidence setiap case tersimpan dan disetujui QA Lead/Product Owner.

Jika ada case `Blocked`, rilis harus ditunda atau diberi pengecualian tertulis dengan risk acceptance yang jelas.
