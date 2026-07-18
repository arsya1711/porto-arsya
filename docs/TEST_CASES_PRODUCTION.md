# Test Cases Produksi — AWExam

Dokumen ini adalah turunan eksekusi dari [TEST_PLAN_PRODUCTION.md](./TEST_PLAN_PRODUCTION.md). Fokus awal adalah test P0 dan P1 inti yang wajib lulus sebelum go-live.

## 1. Petunjuk penggunaan

### Status

- `Not Run`: belum dieksekusi.
- `Pass`: seluruh expected result terpenuhi.
- `Fail`: minimal satu expected result tidak terpenuhi.
- `Blocked`: tidak dapat dilanjutkan karena dependency/environment.
- `Not Applicable`: tidak berlaku dan wajib disetujui QA Lead.

### Kolom hasil eksekusi

Salin blok berikut pada tiket atau test management tool:

```text
Build/Commit SHA:
Migration terakhir:
Environment:
Tanggal/Waktu/WIB:
Tester:
Browser/Perangkat:
Status:
Actual result:
Evidence URL:
Request ID/Log:
Defect ID:
Catatan/Cleanup:
```

### Aturan umum

1. Jangan gunakan service-role key saat menjalankan test authorization.
2. Jalankan request RLS menggunakan session/JWT role yang sedang diuji.
3. Gunakan data berprefix `QA-` dan akun sintetis.
4. Catat waktu server dan waktu perangkat untuk test jadwal/timer.
5. Jangan menghapus data gagal sebelum evidence dan query diagnosis disimpan.
6. Satu expected result yang gagal membuat keseluruhan test case `Fail`.

## 2. Data referensi

| Alias | Data |
|---|---|
| ADMIN_A | Admin aktif `qa+admin-a@example.test` |
| ADMIN_OFF | Admin `active=false` |
| TEACHER_A | Guru Matematika IX A |
| TEACHER_B | Guru IPA VIII B |
| TEACHER_NONE | Guru aktif tanpa penugasan |
| STUDENT_A | Siswa aktif IX A, assigned |
| STUDENT_B | Siswa aktif IX A, assigned |
| STUDENT_OTHER | Siswa aktif VIII B, tidak assigned ujian IX A |
| STUDENT_OFF | Siswa IX A, `active=false` |
| SUBJECT_MATH | Mata pelajaran Matematika |
| CLASS_IXA | Kelas IX A |
| BANK_A | Bank soal milik TEACHER_A |
| MCQ_1 | PG bobot 2, correct_option=1 |
| MCQ_2 | PG bobot 4, correct_option=2 |
| ESSAY_1 | Essay bobot 4 |
| ACCESS_CODE | `QA-IXA-26` |

## 3. Build, environment, dan fail-safe

### TC-CFG-001 — Build production bersih

**Referensi:** CFG-001, CFG-002, CFG-003  
**Priority/Severity:** P0 / S0  
**Precondition:** Clone bersih; Node.js 20+; lockfile tersedia.

**Langkah dan expected result:**

1. Jalankan `npm ci`.
   - Expected: exit code 0; tidak mengubah `package-lock.json`.
2. Jalankan `npm run lint`.
   - Expected: exit code 0; tidak ada ESLint error/warning.
3. Jalankan `npm run build`.
   - Expected: exit code 0; `dist/index.html` dan assets terbentuk.
4. Periksa output build.
   - Expected: tidak ada chunk >500 KB dan tidak ada warning critical.
5. Jalankan `npm run preview`, buka URL preview.
   - Expected: aplikasi dapat dibuka tanpa console error critical.

**Evidence:** Log tiga command, screenshot Network/Console.  
**Cleanup:** Hentikan preview server.

### TC-CFG-002 — Supabase tidak dikonfigurasi

**Referensi:** CFG-004  
**Priority/Severity:** P0 / S0

**Precondition:** Build tanpa `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`.

1. Hapus kedua env dari environment build.
   - Expected: env tidak masuk bundle.
2. Build dan buka aplikasi.
   - Expected: halaman “Konfigurasi server belum tersedia” tampil.
3. Periksa halaman.
   - Expected: tidak ada form login aktif, tombol demo, data siswa, soal, ujian, atau dashboard.
4. Buka `/app`, `/siswa`, `/siswa/ujian/random` langsung.
   - Expected: tetap fail-safe; tidak ada konten sensitif.

**Evidence:** Screenshot seluruh route dan Console.

### TC-CFG-003 — Secret tidak bocor ke browser

**Referensi:** CFG-006, SEC-004  
**Priority/Severity:** P0 / S0

1. Cari string `service_role`, `SUPABASE_SERVICE_ROLE_KEY`, dan key production pada `dist`.
   - Expected: tidak ditemukan.
2. Buka DevTools → Sources dan Network.
   - Expected: hanya anon key yang boleh terlihat.
3. Periksa env hosting.
   - Expected: service-role hanya pada Supabase Edge Function/runtime.
4. Periksa sourcemap publik.
   - Expected: file `.map` tidak disajikan.

**Evidence:** Output pencarian dan screenshot Sources/Network.

## 4. Migration dan database

### TC-MIG-001 — Instalasi migration pada database kosong

**Referensi:** MIG-001, MIG-003, MIG-004  
**Priority/Severity:** P0 / S0

**Precondition:** Project Supabase staging baru tanpa schema aplikasi.

1. Terapkan migration `001` sampai `014` berurutan.
   - Expected: setiap migration sukses tanpa modifikasi manual.
2. Query `pg_tables` untuk schema `public`.
   - Expected: seluruh tabel aplikasi tersedia dan `rowsecurity=true` untuk tabel sensitif.
3. Query `information_schema.routines`.
   - Expected: RPC `start_exam_attempt`, `get_exam_questions`, `submit_exam_attempt`, `grade_essay_answer`, `create_scheduled_exam` tersedia dengan `SECURITY DEFINER`.
4. Query privileges RPC.
   - Expected: `anon`/`PUBLIC` tidak memiliki EXECUTE pada RPC sensitif.
5. Login satu admin/guru/siswa.
   - Expected: profile trigger membuat/menemukan row yang benar.

**Database oracle:** Gunakan query pada bagian 11 Test Plan.  
**Cleanup:** Hapus project staging disposable atau simpan sebagai baseline.

### TC-MIG-002 — Upgrade database berisi data

**Referensi:** MIG-006  
**Priority/Severity:** P0 / S0

**Precondition:** Database berada pada migration `006`, berisi 2 kelas, 3 akun, 1 bank, 3 soal, 1 ujian.

1. Catat count dan checksum data penting.
2. Buat backup/snapshot.
3. Terapkan `007` sampai `014` secara berurutan.
   - Expected: seluruh migration sukses.
4. Bandingkan count/checksum.
   - Expected: data lama tidak hilang/berubah tanpa alasan.
5. Jalankan smoke login, read bank, read exam.
   - Expected: fitur lama tetap bekerja.
6. Jalankan RPC baru menggunakan role valid.
   - Expected: RPC bekerja sesuai role.

**Evidence:** Snapshot sebelum/sesudah, migration log.

### TC-MIG-003 — Policy 007 aman dijalankan ulang

**Referensi:** MIG-002  
**Priority/Severity:** P0 / S1

1. Pastikan `school_settings` dan kedua policy sudah ada.
2. Jalankan ulang isi `007_school_settings.sql`.
   - Expected: tidak muncul error `policy already exists`.
3. Query `pg_policies`.
   - Expected: tepat satu policy read authenticated dan satu policy manage admin.
4. Query `school_settings`.
   - Expected: tepat satu singleton row `id=true`.

## 5. Authentication dan route authorization

### TC-AUTH-001 — Login dan redirect tiga role

**Referensi:** AUTH-001  
**Priority/Severity:** P0 / S0

1. Login sebagai ADMIN_A.
   - Expected: redirect `/app`; menu admin tampil; menu bank/koreksi guru tidak tampil.
2. Logout.
   - Expected: session hilang; kembali ke `/`.
3. Login sebagai TEACHER_A.
   - Expected: redirect `/app`; menu ujian/bank/koreksi tampil; menu admin/audit tidak tampil.
4. Logout dan login STUDENT_A.
   - Expected: redirect `/siswa`; portal staff tidak tampil.
5. Refresh setiap dashboard.
   - Expected: role tetap benar tanpa flash konten role lain.

**DB validation:** `profiles.role` sesuai akun.  
**Evidence:** Screenshot menu dan URL setiap role.

### TC-AUTH-002 — Kredensial salah dan akun nonaktif

**Referensi:** AUTH-002, AUTH-003  
**Priority/Severity:** P0 / S0

1. Login email valid dengan password salah.
   - Expected: gagal; pesan tidak mengungkap detail internal.
2. Login email tidak terdaftar.
   - Expected: respons tidak memudahkan enumerasi akun.
3. Login ADMIN_OFF dengan password benar.
   - Expected: ditolak “akun dinonaktifkan”; session langsung sign-out.
4. Refresh halaman.
   - Expected: tidak masuk dashboard.

### TC-AUTH-003 — Route guard tidak dapat dilewati

**Referensi:** AUTH-004, AUTH-005, AUTH-006  
**Priority/Severity:** P0 / S0

1. Sebagai STUDENT_A buka `/app`, `/app/admin`, `/app/audit`, `/app/koreksi`.
   - Expected: redirect; komponen staff tidak dimuat.
2. Sebagai TEACHER_A buka `/app/admin`, `/app/guru`, `/app/audit`.
   - Expected: redirect `/app`.
3. Sebagai ADMIN_A buka `/siswa/ujian/{validExamId}`.
   - Expected: redirect; runner tidak dimuat.
4. Ulangi dengan URL langsung setelah refresh.
   - Expected: hasil sama.
5. Periksa Network.
   - Expected: tidak ada response data terlarang.

### TC-AUTH-004 — Reset password

**Referensi:** AUTH-010–013  
**Priority/Severity:** P1 / S1

1. Isi email valid dan klik “Lupa kata sandi”.
   - Expected: pesan tautan terkirim.
2. Buka link dari email pada domain staging yang diizinkan.
   - Expected: halaman kata sandi baru tampil.
3. Isi <8 karakter.
   - Expected: ditolak.
4. Isi confirmation berbeda.
   - Expected: ditolak.
5. Isi valid dan sama.
   - Expected: berhasil; login password baru bekerja, password lama gagal.
6. Coba redirect URL domain asing.
   - Expected: tidak diizinkan oleh konfigurasi Supabase.

## 6. RLS dan pemisahan role

### TC-RLS-001 — Guru tidak dapat membaca/mengubah bank guru lain

**Referensi:** QB-012, SEC-RLS  
**Priority/Severity:** P0 / S0

**Precondition:** BANK_A milik TEACHER_A; login TEACHER_B.

1. REST select `question_banks?id=eq.{BANK_A}`.
   - Expected: 0 row/permission denied sesuai policy.
2. REST update nama BANK_A.
   - Expected: 0 row affected/denied.
3. REST delete BANK_A.
   - Expected: denied.
4. REST insert question dengan `bank_id=BANK_A`.
   - Expected: RLS violation.
5. Login TEACHER_A dan read BANK_A.
   - Expected: berhasil.

**DB validation:** Nama/data BANK_A tidak berubah.

### TC-RLS-002 — Siswa hanya melihat attempt/jawaban sendiri

**Referensi:** STD-010, SEC-002  
**Priority/Severity:** P0 / S0

1. Sebagai STUDENT_A, query attempt STUDENT_B dengan UUID diketahui.
   - Expected: 0 row.
2. Query answers milik attempt STUDENT_B.
   - Expected: 0 row.
3. Update answer STUDENT_B.
   - Expected: RLS denied.
4. Query attempt STUDENT_A.
   - Expected: hanya attempt sendiri terlihat.

### TC-RLS-003 — Admin read-only pada konten/nilai guru

**Referensi:** ADM-022, GRD-011  
**Priority/Severity:** P0 / S0

1. Sebagai ADMIN_A, select exams/attempts/answers.
   - Expected: read sesuai policy laporan/admin.
2. Update question milik TEACHER_A.
   - Expected: ditolak.
3. Update exam milik TEACHER_A.
   - Expected: ditolak.
4. Panggil `grade_essay_answer` pada answer TEACHER_A.
   - Expected: ditolak karena bukan teacher owner.
5. Verifikasi data tidak berubah.

### TC-RLS-004 — RPC sensitif tidak dapat dipanggil anon

**Referensi:** SEC-001  
**Priority/Severity:** P0 / S0

1. Tanpa Authorization JWT panggil semua RPC sensitif.
2. Ulangi menggunakan anon key saja.
   - Expected setiap request: permission denied; tidak ada row berubah.
3. Query audit dan attempt count.
   - Expected: tidak ada side effect.

RPC: `start_exam_attempt`, `get_exam_questions`, `submit_exam_attempt`, `grade_essay_answer`, `create_scheduled_exam`.

## 7. Admin dan master data

### TC-ADM-001 — Buat user secara konsisten

**Referensi:** ADM-001, ADM-002  
**Priority/Severity:** P0 / S0

1. Sebagai ADMIN_A buka halaman siswa.
2. Buat `QA-Siswa Baru`, email unik, NIS unik, password valid, role siswa.
   - Expected: modal loading; toast sukses; user muncul.
3. Validasi Auth user dan `profiles`.
   - Expected: satu Auth user dan satu profile dengan ID sama.
4. Coba buat email sama.
   - Expected: ditolak; tidak ada profile/user tambahan.
5. Coba password <8 karakter dan field wajib kosong.
   - Expected: validasi UI menolak sebelum request.

**Cleanup:** Hapus QA user melalui UI; verifikasi Auth/profile terhapus sesuai desain.

### TC-ADM-002 — Nonaktifkan dan aktifkan user

**Referensi:** ADM-003, ADM-004  
**Priority/Severity:** P0 / S0

1. Login user target pada browser A.
2. Admin menonaktifkan user pada browser B.
   - Expected: profile `active=false`; audit log tercatat.
3. Logout/login ulang user target.
   - Expected: login ditolak.
4. Admin aktifkan kembali.
   - Expected: `active=true`; audit tercatat.
5. Login user target.
   - Expected: berhasil.

### TC-ADM-003 — Aktivasi tahun ajaran atomik

**Referensi:** ADM-014, ADM-015  
**Priority/Severity:** P0 / S1

1. Pastikan `2026/2027` aktif dan `2027/2028` nonaktif.
2. Aktifkan `2027/2028`.
   - Expected: tahun baru aktif, lama nonaktif dalam satu transaksi.
3. Dari dua session admin, aktifkan dua tahun berbeda hampir bersamaan.
   - Expected: unique index menjamin hanya satu row aktif.
4. Query `where active=true`.
   - Expected: count=1.

## 8. Bank soal

### TC-QB-001 — Buat soal pilihan ganda valid

**Referensi:** QB-006  
**Priority/Severity:** P0 / S1

1. Login TEACHER_A, pilih BANK_A.
2. Klik tambah soal → Pilihan Ganda.
3. Isi body, 4 opsi, correct option B, difficulty Mudah, weight 2.
4. Simpan.
   - Expected: toast sukses; soal tampil.
5. Query `questions`.
   - Expected: `type=multiple_choice`, options JSON urut, `correct_option=1`, `weight=2`, owner/created_by benar.
6. Refresh.
   - Expected: data tetap sama.

### TC-QB-002 — Validasi PG tidak lengkap

**Referensi:** QB-007, QB-010  
**Priority/Severity:** P0 / S1

1. Body kosong → simpan.
   - Expected: ditolak.
2. Satu opsi kosong → simpan.
   - Expected: ditolak.
3. Tanpa correct option → simpan.
   - Expected: ditolak.
4. Weight 0, -1, nonangka → simpan masing-masing.
   - Expected: ditolak UI/DB.
5. Periksa database.
   - Expected: tidak ada row invalid.

### TC-QB-003 — Buat essay dan cegah XSS

**Referensi:** QB-009, QB-016  
**Priority/Severity:** P0 / S0

1. Buat essay dengan body `<img src=x onerror=alert(1)> Jelaskan...`.
2. Isi answer key, difficulty, bobot 4; simpan.
   - Expected: tersimpan sebagai text.
3. Buka daftar, edit, wizard ujian, dan runner.
   - Expected: script tidak dieksekusi; teks tampil aman.
4. Periksa DOM.
   - Expected: tidak ada element injected dari payload.

## 9. Pembuatan ujian atomik

### TC-EXM-001 — Buat ujian valid end-to-end

**Referensi:** EXM-001, EXM-010, EXM-012  
**Priority/Severity:** P0 / S0

**Precondition:** TEACHER_A assigned SUBJECT_MATH + CLASS_IXA; 2 siswa aktif dan STUDENT_OFF di kelas; MCQ_1, MCQ_2, ESSAY_1 milik guru.

1. Login TEACHER_A → Buat ujian.
2. Isi judul `QA-Ujian Atomik`, SUBJECT_MATH, CLASS_IXA.
3. Pilih tiga soal.
4. Jadwal masa depan, durasi 90, kode ` qa-ixa-26 `, shuffle/fullscreen aktif.
5. Review dan submit sekali.
   - Expected: toast berhasil; satu ujian tampil.
6. Query exam.
   - Expected: title benar, owner auth.uid, status terjadwal, duration 90, access_code `QA-IXA-26`, ends_at=start+90m.
7. Query exam_questions.
   - Expected: 3 row dengan position 0,1,2.
8. Query assignments.
   - Expected: semua siswa aktif IX A assigned; STUDENT_OFF tidak assigned.
9. Query audit_logs.
   - Expected: `exam.created`, actor dan question count benar.

### TC-EXM-002 — Rollback bila soal invalid

**Referensi:** EXM-002, EXM-004, EXM-005  
**Priority/Severity:** P0 / S0

1. Catat count exams, exam_questions, assignments, audit_logs.
2. Sebagai TEACHER_A panggil RPC dengan satu valid question dan satu UUID soal TEACHER_B.
   - Expected: RPC gagal “soal tidak valid/bukan milik guru”.
3. Ulangi dengan archived question.
   - Expected: gagal.
4. Bandingkan count dan cari title QA request.
   - Expected: tidak ada exam, relation, assignment, audit parsial.

### TC-EXM-003 — Tolak penugasan guru tidak valid

**Referensi:** EXM-003  
**Priority/Severity:** P0 / S0

1. Sebagai TEACHER_NONE panggil create RPC dengan subject/class valid.
   - Expected: ditolak.
2. Sebagai TEACHER_A gunakan SUBJECT_MATH + kelas yang tidak ditugaskan.
   - Expected: ditolak.
3. Gunakan subject yang tidak ditugaskan + CLASS_IXA.
   - Expected: ditolak.
4. Pastikan tidak ada data parsial.

### TC-EXM-004 — Validasi jadwal, durasi, dan soal

**Referensi:** EXM-006–009  
**Priority/Severity:** P0 / S1

Jalankan create RPC untuk kombinasi berikut:

| Input | Expected |
|---|---|
| `question_ids=[]` | Ditolak minimal satu soal |
| start_time sekarang-1 menit | Ditolak masa lalu |
| duration 0 | Ditolak |
| duration -1 | Ditolak |
| duration 481 | Ditolak |
| duration 1 | Diterima |
| duration 480 | Diterima |

Setelah setiap penolakan, pastikan tidak ada exam parsial.

### TC-EXM-005 — Double submit wizard

**Referensi:** EXM-015, CON-002  
**Priority/Severity:** P0 / S1

1. Siapkan wizard valid.
2. Klik “Jadwalkan ujian” dua kali cepat atau replay request yang sama.
3. Periksa UI dan database.
   - Expected target: satu ujian. Jika dua ujian terbentuk, catat S1 dan tambahkan idempotency/UI lock sebelum go-live.
4. Pastikan tombol disabled/loading selama request.

## 10. Dashboard dan start attempt

### TC-ATT-001 — Assigned student mulai ujian tanpa kode

**Referensi:** ATT-001, ATT-010  
**Priority/Severity:** P0 / S0

1. Buat ujian aktif tanpa kode untuk STUDENT_A.
2. Login STUDENT_A; buka dashboard.
   - Expected: ujian tersedia.
3. Klik mulai.
   - Expected: RPC membuat satu attempt `in_progress`; runner memuat soal.
4. Catat attempt ID dan started_at; refresh runner.
   - Expected: attempt ID/started_at sama, tidak ada duplicate.
5. Query attempts `(exam_id,student_id)`.
   - Expected: count=1.

### TC-ATT-002 — Kode akses benar dan salah

**Referensi:** ATT-005–007  
**Priority/Severity:** P0 / S0

1. Buka ujian aktif berkode sebagai STUDENT_A.
   - Expected: prompt kode; soal belum ada di Network response.
2. Submit kosong.
   - Expected: UI menolak.
3. Submit `SALAH`.
   - Expected: server menolak; attempt belum dibuat; soal tidak diberikan.
4. Submit ` qa-ixa-26 ` atau variasi kapital.
   - Expected: diterima; attempt dibuat; soal dimuat.
5. Periksa Network sebelum kode benar.
   - Expected: tidak ada body/options soal.

### TC-ATT-003 — Penugasan dan jadwal ditegakkan server

**Referensi:** ATT-002–004  
**Priority/Severity:** P0 / S0

1. STUDENT_OTHER panggil start untuk ujian IX A.
   - Expected: “tidak ditugaskan”.
2. STUDENT_A panggil start untuk ujian sebelum starts_at.
   - Expected: “belum dapat dimulai”.
3. STUDENT_A panggil start setelah ends_at.
   - Expected: “waktu sudah berakhir”.
4. Ubah jam lokal perangkat agar masuk rentang lalu ulangi.
   - Expected: tetap ditolak karena `now()` server.

### TC-ATT-004 — Soal tidak bocor tanpa attempt aktif

**Referensi:** ATT-008, ATT-009, SEC-003  
**Priority/Severity:** P0 / S0

1. Sebagai assigned STUDENT_A panggil `get_exam_questions` sebelum start.
   - Expected: 0 row.
2. Start lalu panggil.
   - Expected: body/type/options/weight tersedia.
3. Periksa payload.
   - Expected: tidak ada `correct_option` atau `answer_key`.
4. Submit/finalkan attempt; panggil lagi.
   - Expected: 0 row.

## 11. Runner, autosave, dan submit

### TC-RUN-001 — Autosave pilihan ganda

**Referensi:** RUN-002, RUN-003  
**Priority/Severity:** P0 / S0

1. Pilih opsi A MCQ_1.
   - Expected: UI selected; satu upsert sukses.
2. Query answers.
   - Expected: selected_option=0, essay_text=null.
3. Ubah ke opsi B.
   - Expected: row yang sama berubah selected_option=1; tidak duplicate.
4. Refresh.
   - Expected: opsi B tetap terpilih dari server.

### TC-RUN-002 — Debounce dan flush essay

**Referensi:** RUN-004, RUN-005, CON-003  
**Priority/Severity:** P0 / S0

1. Buka essay; kosongkan Network log.
2. Ketik 100 karakter cepat dalam <500 ms.
   - Expected: UI tidak lag; request tidak dikirim tiap karakter.
3. Berhenti 600–1.000 ms.
   - Expected: satu request berisi nilai akhir.
4. Ketik kalimat baru lalu segera klik submit.
   - Expected: pending essay disimpan sebelum `submit_exam_attempt`.
5. Query answers.
   - Expected: essay_text berisi teks paling akhir secara lengkap.

### TC-RUN-003 — Refresh dan recovery jawaban

**Referensi:** RUN-006, REL-001  
**Priority/Severity:** P0 / S0

1. Jawab 2 PG dan 1 essay; tunggu save selesai.
2. Tutup paksa tab/browser.
3. Login dan buka kembali ujian.
   - Expected: attempt sama; ketiga jawaban pulih.
4. Navigator/progress.
   - Expected: 3 terjawab; posisi visual benar.

### TC-RUN-004 — Gangguan jaringan saat autosave

**Referensi:** RUN-008, RUN-009, REL-002  
**Priority/Severity:** P0 / S0

1. Aktifkan DevTools Offline.
2. Pilih PG/ketik essay.
   - Expected: pesan “belum tersinkron”; aplikasi tidak mengklaim tersimpan server.
3. Coba submit.
   - Expected: gagal jelas; local cache tidak dihapus; tetap di halaman.
4. Kembalikan Online dan ubah/simpan jawaban lagi.
   - Expected: sinkron berhasil.
5. Submit ulang.
   - Expected: berhasil; cache dibersihkan setelah server sukses.

### TC-RUN-005 — Lock jawaban setelah submit

**Referensi:** RUN-010, RUN-012, RUN-014  
**Priority/Severity:** P0 / S0

1. Submit attempt aktif.
   - Expected: status submitted/final sesuai jenis soal.
2. Replay upsert answer menggunakan JWT siswa.
   - Expected: RLS menolak.
3. Replay submit RPC.
   - Expected: ditolak “sudah dikumpulkan”; nilai/status tidak berubah.
4. Panggil start RPC lagi.
   - Expected: ditolak.

### TC-RUN-006 — Timeout otomatis

**Referensi:** RUN-013, CON-004  
**Priority/Severity:** P0 / S0

1. Buat ujian durasi 1 menit dan start.
2. Jawab soal; tunggu timer 00:00:00 tanpa klik submit.
   - Expected: pending save diflush; submit RPC otomatis satu kali.
3. Pada detik terakhir klik submit manual bersamaan timeout.
   - Expected: tidak ada corrupt/duplicate; satu hasil final konsisten.
4. Query submitted_at/status/answers.
   - Expected: seluruh jawaban tersimpan; status benar.

### TC-RUN-007 — Integrity event saat keluar tab

**Referensi:** RUN-019, RUN-020  
**Priority/Severity:** P0 / S1

1. Saat attempt aktif, pindah tab lalu kembali.
2. Minimize/restore browser.
3. Query `integrity_events`.
   - Expected: event `tab_hidden` terkait attempt yang benar; student ID tervalidasi policy.
4. Coba insert event untuk attempt siswa lain.
   - Expected: ditolak.

## 12. Scoring

### TC-SCR-001 — PG semua benar

**Referensi:** SCR-001, SCR-005  
**Priority/Severity:** P0 / S0

**Data:** MCQ_1 bobot 2 benar option 1; MCQ_2 bobot 4 benar option 2; tanpa essay.

1. Jawab keduanya benar; submit.
2. Query attempt.
   - Expected: `objective_score=6`, `essay_score=null/0`, `final_score=100.00`, `status=final`, `finalized_at` terisi.

### TC-SCR-002 — PG campuran berbobot

**Referensi:** SCR-002–004  
**Priority/Severity:** P0 / S0

1. Jawab MCQ_1 benar (2), MCQ_2 salah (0); submit.
   - Expected: total 2/6; `final_score=33.33`.
2. Attempt baru semua salah.
   - Expected: 0.00.
3. Attempt baru kosong satu soal bobot 4 dan benar soal bobot 2.
   - Expected: tetap 33.33; kosong bernilai 0.

### TC-SCR-003 — Ujian campuran menunggu koreksi

**Referensi:** SCR-006  
**Priority/Severity:** P0 / S0

1. Ujian MCQ_1+MCQ_2+ESSAY_1; jawab dan submit.
2. Query attempt.
   - Expected: objective_score dihitung, status=submitted, final_score/finalized_at null.
3. Dashboard siswa.
   - Expected: status menunggu koreksi, bukan nilai final palsu.

### TC-SCR-004 — Nilai kombinasi PG dan essay

**Referensi:** GRD-007–009  
**Priority/Severity:** P0 / S0

**Oracle:** PG total 6, poin benar 4; essay total 4, awarded 3; expected 7/10=70.00.

1. Submit jawaban siswa sesuai oracle.
2. TEACHER_A grade ESSAY_1 score=3.
3. Query answer dan attempt.
   - Expected: answer.score=3; objective_score=4; essay_score=3; final_score=70.00; status=final; finalized_at terisi.
4. Dashboard/laporan.
   - Expected: nilai 70 konsisten.

## 13. Koreksi essay

### TC-GRD-001 — Guru menilai essay miliknya

**Referensi:** GRD-001, GRD-004, GRD-013  
**Priority/Severity:** P0 / S1

1. Login TEACHER_A → Koreksi.
   - Expected: hanya jawaban exam milik TEACHER_A berstatus submitted/grading.
2. Buka rubric.
   - Expected: question, answer key, weight tampil benar.
3. Isi score 0 dan komentar; simpan.
   - Expected: diterima; data tersimpan.
4. Ubah ke score maksimum weight; simpan.
   - Expected: diterima.
5. Refresh.
   - Expected: score/comment pulih.

### TC-GRD-002 — Tolak skor di luar bobot

**Referensi:** GRD-003  
**Priority/Severity:** P0 / S1

1. Untuk essay weight 4 masukkan -1.
   - Expected: UI menolak; RPC tidak dipanggil.
2. Masukkan 5.
   - Expected: ditolak.
3. Panggil RPC langsung awarded_score=5.
   - Expected: server menolak.
4. Query answer.
   - Expected: score lama tidak berubah.

### TC-GRD-003 — Guru lain tidak dapat menilai

**Referensi:** GRD-002, GRD-010  
**Priority/Severity:** P0 / S0

1. Login TEACHER_B; query answer TEACHER_A.
   - Expected: tidak terlihat.
2. Dengan UUID answer diketahui, panggil grade RPC.
   - Expected: “tidak dapat dinilai”.
3. Query sebagai TEACHER_A.
   - Expected: score/comment tidak berubah.

## 14. Laporan dan ekspor

### TC-RPT-001 — Statistik sesuai database

**Referensi:** RPT-001, RPT-003  
**Priority/Severity:** P0 / S1

**Data:** Empat final score 100, 80, 70, 50.

1. Buka laporan sebagai role yang berhak.
2. Bandingkan UI dengan oracle.
   - Expected: average 75; highest 100; lowest 50; lulus KKM 2/4=50%.
3. Bandingkan nama pemilik nilai tertinggi.
   - Expected: benar.
4. Pastikan attempt non-final tidak masuk statistik final.

### TC-RPT-002 — CSV aman dan akurat

**Referensi:** RPT-005, RPT-006  
**Priority/Severity:** P1 / S2

1. Gunakan nama `QA "Putri, A"`.
2. Klik ekspor laporan.
   - Expected: file `.csv` terunduh dengan UTF-8 BOM.
3. Buka di spreadsheet dan text editor.
   - Expected: header/row benar; koma/quote ter-escape; Unicode tidak rusak.
4. Cocokkan jumlah row dengan UI/database.

## 15. Concurrency dan recovery

### TC-CON-001 — Start attempt dua tab

**Referensi:** CON-001  
**Priority/Severity:** P0 / S0

1. Login STUDENT_A di dua tab.
2. Klik mulai ujian yang sama hampir bersamaan.
3. Query attempts.
   - Expected: satu row karena unique `(exam_id,student_id)`.
4. Kedua tab.
   - Expected: mengarah attempt sama atau salah satu gagal terkontrol; tidak ada crash.

### TC-CON-002 — Submit dan autosave bersamaan

**Referensi:** CON-003, CON-004  
**Priority/Severity:** P0 / S0

1. Throttle network Slow 3G.
2. Ketik essay lalu submit segera.
3. Pantau urutan request.
   - Expected: answer upsert selesai sebelum submit RPC.
4. Query hasil.
   - Expected: jawaban terakhir dan nilai/status konsisten.

### TC-REL-001 — Supabase gagal saat submit

**Referensi:** REL-003, REL-004  
**Priority/Severity:** P0 / S0

1. Setelah semua jawaban tersimpan, blok request Supabase sebelum submit.
2. Klik submit.
   - Expected: pesan gagal; tetap di runner; local cache tidak dihapus.
3. Pulihkan koneksi.
4. Klik submit lagi.
   - Expected: berhasil sekali; cache dibersihkan; dashboard menampilkan status benar.

### TC-REL-002 — Backup dan restore

**Referensi:** REL-005  
**Priority/Severity:** P0 / S0

1. Buat snapshot staging setelah data test selesai.
2. Catat count/checksum profiles, exams, attempts, answers.
3. Simulasikan kehilangan data pada database disposable.
4. Restore backup.
5. Bandingkan count/checksum dan jalankan smoke E2E.
   - Expected: sesuai RPO/RTO yang disetujui; aplikasi berfungsi.

## 16. Security

### TC-SEC-001 — Kunci jawaban tidak bocor

**Referensi:** SEC-003  
**Priority/Severity:** P0 / S0

1. Login STUDENT_A dan mulai ujian.
2. Simpan HAR seluruh Network session.
3. Cari `correct_option`, `answer_key`, jawaban benar, dan rubric.
   - Expected: tidak ada pada HTML, JS runtime data, Local Storage, Network response.
4. Panggil REST `questions` langsung dengan UUID soal.
   - Expected: RLS menolak siswa.

### TC-SEC-002 — XSS stored pada seluruh input

**Referensi:** SEC-005  
**Priority/Severity:** P0 / S0

**Payload:** `<svg/onload=window.__xss=1>` dan `"><script>alert(1)</script>`.

1. Masukkan payload pada nama user, nama sekolah, nama bank, soal, opsi, answer key, essay answer, teacher comment.
2. Buka seluruh halaman yang menampilkan data tersebut pada setiap role.
   - Expected: payload tampil sebagai text/escaped atau ditolak; tidak dieksekusi.
3. Cek `window.__xss` dan Console.
   - Expected: undefined; tidak ada alert/execution.

### TC-SEC-003 — Manipulasi clock lokal

**Referensi:** SEC-013  
**Priority/Severity:** P0 / S0

1. Set jam perangkat sebelum starts_at agar tampak sudah mulai.
   - Expected: start tetap ditolak server.
2. Set jam perangkat mundur saat timer hampir habis.
   - Expected: deadline berasal dari server dan tidak bertambah setelah reload.
3. Set jam perangkat maju.
   - Expected: tidak membuat attempt final secara salah; reload kembali mengikuti deadline server.

### TC-SEC-004 — Replay dan object ID tampering

**Referensi:** SEC-002, SEC-014  
**Priority/Severity:** P0 / S0

1. Capture request start/save/submit/grade.
2. Ganti exam_id dengan exam bukan assignment.
   - Expected: ditolak.
3. Ganti attempt_id dengan attempt siswa lain.
   - Expected: ditolak.
4. Ganti answer_id dengan milik guru lain.
   - Expected: ditolak.
5. Replay request valid setelah status final.
   - Expected: tidak ada perubahan.

## 17. Accessibility dan compatibility P0/P1

### TC-A11Y-001 — Alur ujian keyboard-only

**Referensi:** A11Y-001, A11Y-002  
**Priority/Severity:** P1 / S2

1. Tanpa mouse, login siswa.
2. Masukkan kode, navigasi soal, pilih PG, isi essay, tandai, review, submit.
   - Expected: seluruh kontrol tercapai dengan Tab/Shift+Tab/Enter/Space.
3. Periksa focus indicator dan urutan.
   - Expected: terlihat jelas dan logis; focus tidak terjebak kecuali modal secara benar.

### TC-COMP-001 — Matriks browser siswa

**Referensi:** ENV-01–07, RUN-024  
**Priority/Severity:** P0 Chrome/Edge/Android; P1 lainnya

Eksekusi smoke login→start→PG→essay→submit pada setiap environment target.

Expected:

- Tidak ada layout overlap/tombol tertutup.
- Timer dan autosave bekerja.
- Modal dapat discroll.
- Keyboard mobile tidak menutup field/tombol penting.
- Refresh/session recovery konsisten.

## 18. Smoke production

### TC-SMK-001 — Smoke setelah deployment

**Referensi:** Bagian 28 Test Plan  
**Priority/Severity:** P0 / S0

**Precondition:** Akun dan data khusus smoke; bukan siswa/ujian nyata.

1. Buka domain HTTPS; cek certificate dan Console.
2. Login ADMIN_A; buka dashboard, audit, settings.
3. Login TEACHER_A; buat satu bank/soal bila belum tersedia.
4. Buat ujian smoke 1 soal, 1 kelas smoke, jadwal aktif sesuai prosedur.
5. Login STUDENT_A; start, jawab, submit.
6. Jika essay, grade sebagai TEACHER_A.
7. Buka laporan; cocokkan nilai.
8. Cek audit dan integrity event.
9. Bersihkan/archive data smoke.

**Expected:** Semua tahap sukses tanpa error S0/S1. Jika langkah 1–7 gagal, keputusan otomatis `NO-GO/ROLLBACK`.

## 19. Execution checklist

| Test Case | Status | Defect | Tester | Date |
|---|---|---|---|---|
| TC-CFG-001 | Not Run | | | |
| TC-CFG-002 | Not Run | | | |
| TC-CFG-003 | Not Run | | | |
| TC-MIG-001 | Not Run | | | |
| TC-MIG-002 | Not Run | | | |
| TC-MIG-003 | Not Run | | | |
| TC-AUTH-001 | Not Run | | | |
| TC-AUTH-002 | Not Run | | | |
| TC-AUTH-003 | Not Run | | | |
| TC-AUTH-004 | Not Run | | | |
| TC-RLS-001 | Not Run | | | |
| TC-RLS-002 | Not Run | | | |
| TC-RLS-003 | Not Run | | | |
| TC-RLS-004 | Not Run | | | |
| TC-ADM-001 | Not Run | | | |
| TC-ADM-002 | Not Run | | | |
| TC-ADM-003 | Not Run | | | |
| TC-QB-001 | Not Run | | | |
| TC-QB-002 | Not Run | | | |
| TC-QB-003 | Not Run | | | |
| TC-EXM-001 | Not Run | | | |
| TC-EXM-002 | Not Run | | | |
| TC-EXM-003 | Not Run | | | |
| TC-EXM-004 | Not Run | | | |
| TC-EXM-005 | Not Run | | | |
| TC-ATT-001 | Not Run | | | |
| TC-ATT-002 | Not Run | | | |
| TC-ATT-003 | Not Run | | | |
| TC-ATT-004 | Not Run | | | |
| TC-RUN-001 | Not Run | | | |
| TC-RUN-002 | Not Run | | | |
| TC-RUN-003 | Not Run | | | |
| TC-RUN-004 | Not Run | | | |
| TC-RUN-005 | Not Run | | | |
| TC-RUN-006 | Not Run | | | |
| TC-RUN-007 | Not Run | | | |
| TC-SCR-001 | Not Run | | | |
| TC-SCR-002 | Not Run | | | |
| TC-SCR-003 | Not Run | | | |
| TC-SCR-004 | Not Run | | | |
| TC-GRD-001 | Not Run | | | |
| TC-GRD-002 | Not Run | | | |
| TC-GRD-003 | Not Run | | | |
| TC-RPT-001 | Not Run | | | |
| TC-RPT-002 | Not Run | | | |
| TC-CON-001 | Not Run | | | |
| TC-CON-002 | Not Run | | | |
| TC-REL-001 | Not Run | | | |
| TC-REL-002 | Not Run | | | |
| TC-SEC-001 | Not Run | | | |
| TC-SEC-002 | Not Run | | | |
| TC-SEC-003 | Not Run | | | |
| TC-SEC-004 | Not Run | | | |
| TC-A11Y-001 | Not Run | | | |
| TC-COMP-001 | Not Run | | | |
| TC-SMK-001 | Not Run | | | |

## 20. Sign-off

| Peran | Nama | Keputusan | Tanggal | Tanda tangan/Link approval |
|---|---|---|---|---|
| QA Lead | | | | |
| Product Owner | | | | |
| DBA/Backend | | | | |
| Security QA | | | | |
| Admin Sekolah | | | | |
| Perwakilan Guru | | | | |
| IT/Release Lead | | | | |

Keputusan hanya boleh `GO`, `CONDITIONAL GO`, atau `NO-GO`. Semua P0 harus `Pass` untuk keputusan `GO`.
