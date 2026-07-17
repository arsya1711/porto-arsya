# Test Plan Produksi — Ruang Ujian

| Atribut | Nilai |
|---|---|
| Dokumen | Test Plan Produksi |
| Produk | Ruang Ujian Web |
| Versi awal | 1.0 |
| Tanggal | 17 Juli 2026 |
| Pemilik | QA Lead / Product Owner |
| Status | Draft untuk staging |
| Target | Persetujuan go-live ujian sekolah |

## 1. Tujuan

Memastikan aplikasi layak digunakan untuk ujian sekolah nyata dengan memverifikasi:

1. Fungsi bisnis admin, guru, dan siswa berjalan end-to-end.
2. Pemisahan akses berbasis role dan Row Level Security (RLS) tidak dapat dilewati.
3. Jawaban siswa tersimpan konsisten, terkunci setelah submit, dan tidak hilang saat refresh atau gangguan jaringan.
4. Waktu, kode akses, penugasan peserta, scoring, koreksi essay, dan nilai akhir dihitung oleh server secara benar.
5. Migration `001`–`010` dapat diterapkan pada database kosong dan database staging yang sudah terisi.
6. Aplikasi stabil pada browser/perangkat target dan beban ujian serentak.
7. Tim operasional memiliki prosedur recovery, bukti pengujian, dan keputusan go/no-go yang terdokumentasi.

## 2. Ruang lingkup

### 2.1 Termasuk

- Supabase Auth: login, logout, pemulihan kata sandi, session recovery.
- Role dan route guard: admin, guru, siswa.
- Manajemen administrator, guru, siswa, kelas, mata pelajaran, dan tahun ajaran.
- Penugasan guru ke mata pelajaran/kelas.
- Bank soal pilihan ganda dan essay.
- Pembuatan ujian atomik, jadwal, durasi, kode akses, pemilihan soal, dan peserta.
- Dashboard admin, guru, dan siswa.
- Ruang ujian: start attempt, navigator, autosave, refresh, integrity event, timeout, submit.
- Scoring pilihan ganda dan koreksi essay.
- Laporan, ekspor CSV, pengaturan sekolah, audit log.
- RLS, RPC, migration, keamanan browser/API, performa, aksesibilitas, compatibility, backup/recovery.

### 2.2 Tidak termasuk

- Kiosk mode native Android/iOS.
- Proctoring video/audio.
- Offline penuh tanpa koneksi sepanjang ujian.
- Integrasi SSO eksternal yang belum menjadi bagian produk.
- Penetration test tersertifikasi pihak ketiga; tetap direkomendasikan sebelum deployment skala besar.

## 3. Referensi

- `docs/PRD_Aplikasi_Ujian_Sekolah_v1.1.pdf`
- `README.md`
- `supabase/migrations/001_initial_schema.sql` sampai `010_atomic_exam_creation.sql`
- Source route dan role guard pada `src/App.tsx`
- Dashboard pada `src/components/Dashboards.tsx`
- Bank soal pada `src/components/QuestionBank.tsx`

## 4. Strategi pengujian

| Level | Tujuan | Pelaksana | Kapan |
|---|---|---|---|
| Static | TypeScript, lint, kesalahan format | Developer/CI | Setiap commit |
| Database | Migration, constraint, RLS, RPC | Backend QA | Setiap perubahan schema |
| Component | Validasi form dan state UI | Developer QA | Setiap fitur |
| Integration | React ↔ Supabase ↔ Auth ↔ RLS | QA | Staging |
| E2E | Alur admin–guru–siswa | QA/UAT | Sebelum release |
| Security | Authorization, leakage, abuse | Security QA | Sebelum go-live |
| Performance | Ujian serentak dan autosave | Performance QA | Staging mirip production |
| UAT | Kesesuaian operasional sekolah | Admin, guru, pengawas | H-14 sampai H-7 |
| Smoke production | Fungsi minimal setelah deploy | Release team | Setiap deployment |

## 5. Environment

### 5.1 Environment wajib

| Environment | Data | Tujuan | Larangan |
|---|---|---|---|
| Local | Sintetis | Development dan static check | Jangan pakai data siswa nyata |
| Staging | Sintetis menyerupai production | E2E, security, load, UAT | Jangan memakai service-role di browser |
| Production | Data resmi | Smoke test terbatas | Jangan menjalankan destructive test |

### 5.2 Konfigurasi staging

- Domain HTTPS terpisah dari production.
- Project Supabase staging terpisah.
- Migration `001`–`010` sudah diterapkan.
- Redirect URL Auth hanya mengarah ke domain staging yang diizinkan.
- Edge Function `admin-users` sudah di-deploy.
- Secret service-role hanya tersedia pada Supabase runtime.
- Browser memakai anon key, bukan service-role key.
- Waktu server dan perangkat tester sinkron.
- Backup staging tersedia sebelum destructive test.

### 5.3 Matriks browser/perangkat

| Kode | Platform | Browser | Resolusi minimum | Prioritas |
|---|---|---|---|---|
| ENV-01 | Windows 10/11 | Chrome terbaru dan N-1 | 1366×768 | P0 |
| ENV-02 | Windows 10/11 | Edge terbaru dan N-1 | 1366×768 | P0 |
| ENV-03 | macOS | Safari terbaru | 1440×900 | P1 |
| ENV-04 | macOS | Chrome terbaru | 1440×900 | P1 |
| ENV-05 | Android 11+ | Chrome terbaru | 360×800 | P0 siswa |
| ENV-06 | iOS 16+ | Safari terbaru | 390×844 | P1 siswa |
| ENV-07 | Tablet Android/iPad | Chrome/Safari | 768×1024 | P1 |

## 6. Data uji standar

### 6.1 Akun

| Kode | Role | Kondisi |
|---|---|---|
| ADM-01 | Admin aktif | Akun utama pengujian |
| ADM-02 | Admin aktif | Uji isolasi antar akun |
| ADM-03 | Admin nonaktif | Uji penolakan login |
| GUR-01 | Guru aktif | Ditugaskan Matematika IX A |
| GUR-02 | Guru aktif | Ditugaskan IPA VIII B |
| GUR-03 | Guru aktif | Tidak memiliki penugasan |
| GUR-04 | Guru nonaktif | Uji penolakan login |
| SIS-01 | Siswa aktif | IX A, peserta ujian |
| SIS-02 | Siswa aktif | IX A, peserta ujian |
| SIS-03 | Siswa aktif | VIII B, bukan peserta ujian IX A |
| SIS-04 | Siswa nonaktif | Sudah pernah menjadi anggota kelas |
| SIS-05 | Siswa aktif | Tidak memiliki kelas |

Gunakan email sintetis seperti `qa+adm01@example.test`. Jangan memakai email atau NIS asli.

### 6.2 Master dan konten

- Tahun ajaran: `2026/2027` aktif, `2025/2026` nonaktif.
- Kelas: IX A (32 siswa), IX B (30), VIII B (30), Kelas Kosong (0).
- Mata pelajaran: Matematika, IPA, Bahasa Indonesia.
- Bank soal milik GUR-01 dan bank soal milik GUR-02.
- Minimal 10 pilihan ganda dengan bobot bervariasi.
- Minimal 5 essay dengan kunci dan bobot bervariasi.
- Satu soal archived.
- Satu ujian tanpa kode dan satu ujian berkode.
- Jadwal: masa depan, sedang aktif, baru berakhir, dan sudah lama berakhir.

### 6.3 Aturan data

- Password QA minimal 12 karakter dan unik per role.
- Kode akses contoh: `QA-IXA-26`.
- KKM acuan test: 75.
- Semua waktu dicatat beserta zona waktu `Asia/Jakarta`.
- Setiap test destructive harus membuat data dengan prefix `QA-` agar mudah dibersihkan.

## 7. Entry criteria

Pengujian staging dimulai hanya jika:

- `npm ci`, `npm run build`, dan `npm run lint` berhasil.
- Migration berhasil diterapkan ke database staging bersih.
- URL dan anon key staging valid.
- Edge Function tersedia dan health check berhasil.
- Akun serta data uji sudah dibuat.
- Tidak ada defect P0 terbuka dari build sebelumnya.
- QA mengetahui commit SHA, migration terakhir, dan URL build yang diuji.

## 8. Definisi severity dan priority

| Severity | Definisi | Contoh |
|---|---|---|
| S0 Blocker | Ujian tidak dapat berlangsung atau terjadi kehilangan/kebocoran data luas | Siswa tidak bisa submit, jawaban benar bocor |
| S1 Critical | Fungsi utama salah untuk sebagian besar pengguna | Timer salah, RLS lintas guru bocor |
| S2 Major | Fungsi penting terganggu tetapi ada workaround | Ekspor gagal, filter tidak bekerja |
| S3 Minor | Gangguan kecil/nonkritis | Label, alignment, pesan kurang jelas |
| S4 Cosmetic | Visual tanpa dampak fungsi | Spasi atau warna kecil |

Priority: P0 wajib sebelum go-live; P1 wajib sebelum release umum; P2 dapat dijadwalkan; P3 backlog.

## 9. Format test evidence

Setiap eksekusi wajib menyimpan:

- Test ID dan build/commit SHA.
- Tester, tanggal, browser/perangkat.
- Akun role yang digunakan (tanpa password).
- Data input nonrahasia.
- Screenshot atau rekaman untuk UI.
- Request ID/log Supabase untuk kegagalan backend.
- Query read-only sebelum/sesudah untuk validasi database.
- Actual result, status Pass/Fail/Blocked, defect ID.

## 10. Test cases — Build dan konfigurasi

| ID | Pri | Skenario dan langkah inti | Hasil yang diharapkan |
|---|---|---|---|
| CFG-001 | P0 | Jalankan `npm ci` pada clone bersih | Dependency terpasang tanpa perubahan lockfile |
| CFG-002 | P0 | Jalankan `npm run build` | Exit 0; artifact `dist` terbentuk |
| CFG-003 | P0 | Jalankan `npm run lint` | Exit 0 tanpa error/warning |
| CFG-004 | P0 | Build tanpa dua env Supabase | Aplikasi menampilkan halaman konfigurasi; tidak ada login/data contoh |
| CFG-005 | P0 | Pakai URL/key salah | Error terkontrol; tidak ada layar putih atau data palsu |
| CFG-006 | P0 | Cari service-role key pada source, bundle, Network | Tidak ditemukan |
| CFG-007 | P1 | Buka route tidak dikenal | Redirect aman ke route sesuai session |
| CFG-008 | P1 | Picu runtime error pada staging instrumented | Error boundary tampil dan tombol muat ulang bekerja |
| CFG-009 | P1 | Refresh route `/app/bank-soal` di hosting | Server fallback ke `index.html`; tidak 404 |
| CFG-010 | P1 | Periksa bundle production | Tidak ada sourcemap publik, secret, atau data mock |

## 11. Test cases — Migration dan schema

### 11.1 Instalasi migration

| ID | Pri | Langkah | Hasil yang diharapkan |
|---|---|---|---|
| MIG-001 | P0 | Terapkan `001`–`010` ke database kosong | Semua sukses berurutan |
| MIG-002 | P0 | Jalankan kembali migration idempotent yang diizinkan (`007` dst.) | Tidak gagal karena policy/object sudah ada |
| MIG-003 | P0 | Verifikasi seluruh tabel, enum, FK, index, trigger, RPC | Sesuai migration |
| MIG-004 | P0 | Verifikasi RLS aktif pada seluruh tabel public sensitif | Semua aktif |
| MIG-005 | P0 | Verifikasi EXECUTE RPC untuk `anon` | Ditolak pada RPC sensitif |
| MIG-006 | P0 | Upgrade database berisi data dari `006` ke `010` | Data lama tetap utuh |
| MIG-007 | P1 | Rollback staging dari backup sebelum migration | Database dapat dipulihkan dan aplikasi kembali berfungsi |
| MIG-008 | P1 | Cek unique active academic year | Tidak dapat memiliki dua tahun aktif |
| MIG-009 | P1 | Hapus kelas/soal yang direferensikan | Constraint mencegah kerusakan atau cascade sesuai desain |
| MIG-010 | P1 | Insert bobot 0/negatif dan durasi 0 | Constraint menolak |

### 11.2 Query audit read-only

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

select routine_name, security_type
from information_schema.routines
where routine_schema = 'public'
order by routine_name;

select grantee, routine_name, privilege_type
from information_schema.routine_privileges
where specific_schema = 'public'
  and routine_name in (
    'start_exam_attempt', 'get_exam_questions', 'submit_exam_attempt',
    'grade_essay_answer', 'create_scheduled_exam'
  )
order by routine_name, grantee;
```

Expected: RPC sensitif hanya executable oleh role yang dimaksud; tidak ada grant `PUBLIC`/`anon`.

## 12. Test cases — Authentication dan session

| ID | Pri | Langkah inti | Expected |
|---|---|---|---|
| AUTH-001 | P0 | Login setiap role dengan kredensial benar | Redirect sesuai role |
| AUTH-002 | P0 | Password salah | Pesan aman; tidak membocorkan keberadaan email |
| AUTH-003 | P0 | Login akun `active=false` | Ditolak dan session dibersihkan |
| AUTH-004 | P0 | Siswa membuka `/app` | Redirect `/` atau `/siswa`; konten staff tidak terlihat |
| AUTH-005 | P0 | Guru membuka route admin | Redirect `/app`; data admin tidak dimuat |
| AUTH-006 | P0 | Admin membuka `/siswa/ujian/:id` | Ditolak oleh guard |
| AUTH-007 | P0 | Hapus/ubah token di storage lalu refresh | Session invalid dibersihkan |
| AUTH-008 | P1 | Refresh halaman saat login | Session pulih tanpa flash konten role lain |
| AUTH-009 | P1 | Logout pada dua tab | Kedua tab akhirnya keluar |
| AUTH-010 | P1 | Reset password email valid | Email terkirim; redirect benar |
| AUTH-011 | P1 | Reset password email invalid | Pesan generik dan aman |
| AUTH-012 | P1 | Password baru <8 karakter | Ditolak UI |
| AUTH-013 | P1 | Konfirmasi password berbeda | Ditolak UI |
| AUTH-014 | P1 | Session kedaluwarsa saat operasi | User mendapat error/redirect terkontrol |
| AUTH-015 | P1 | 20 percobaan login gagal | Supabase rate limit/captcha policy diuji dan dicatat |

## 13. Test cases — Admin

### 13.1 Pengguna dan kelas

| ID | Pri | Skenario | Expected |
|---|---|---|---|
| ADM-001 | P0 | Buat akun admin/guru/siswa dengan data valid | Auth user dan profile konsisten |
| ADM-002 | P0 | Buat email duplikat | Ditolak tanpa profile yatim |
| ADM-003 | P0 | Nonaktifkan user | User tidak dapat login lagi |
| ADM-004 | P0 | Aktifkan kembali user | Login kembali berhasil |
| ADM-005 | P0 | Reset password sementara | Password baru bekerja; lama tidak |
| ADM-006 | P0 | Hapus user | Data terkait mengikuti aturan FK; tidak korup |
| ADM-007 | P1 | Edit nama/email/NIS | Tersimpan dan tampil konsisten |
| ADM-008 | P1 | Search berdasarkan nama, email, NIS | Hasil tepat dan case-insensitive |
| ADM-009 | P1 | Filter kelas | Hanya anggota kelas terpilih |
| ADM-010 | P0 | Buat kelas, tambah/hapus siswa | Membership konsisten |
| ADM-011 | P0 | Coba satu siswa di kondisi membership tak valid | Sistem menolak sesuai aturan bisnis |
| ADM-012 | P1 | Kelas kosong | Empty state benar; tidak crash |
| ADM-013 | P1 | Data 1.000 siswa | Pagination/scroll tetap usable |

### 13.2 Tahun ajaran, mata pelajaran, audit

| ID | Pri | Skenario | Expected |
|---|---|---|---|
| ADM-014 | P0 | Aktifkan tahun ajaran lain | Tahun lama nonaktif secara atomik |
| ADM-015 | P0 | Dua admin mengaktifkan tahun berbeda bersamaan | Tetap hanya satu aktif |
| ADM-016 | P1 | Rename/delete tahun | Validasi dan constraint benar |
| ADM-017 | P0 | CRUD mata pelajaran | Data tersimpan; kode unik |
| ADM-018 | P1 | Kode mata pelajaran duplikat | Ditolak dengan pesan jelas |
| ADM-019 | P0 | Verifikasi audit setelah CRUD master/user/ujian | Actor, action, entity, waktu benar |
| ADM-020 | P1 | Search/filter audit | Hasil akurat |
| ADM-021 | P0 | Guru mencoba mutasi master via REST langsung | RLS menolak |
| ADM-022 | P0 | Admin mencoba mengubah konten/nilai guru via REST | Ditolak sesuai separation policy |

### 13.3 Pengaturan sekolah

| ID | Pri | Skenario | Expected |
|---|---|---|---|
| SET-001 | P0 | Admin simpan profil sekolah | Tersimpan di `school_settings` |
| SET-002 | P1 | Refresh/browser lain | Nilai server tampil konsisten |
| SET-003 | P0 | Guru/siswa mencoba update REST | RLS menolak |
| SET-004 | P1 | Dua admin edit bersamaan | Perilaku last-write terdokumentasi; tidak korup |
| SET-005 | P1 | Input kosong/panjang/special chars | Validasi sesuai ketentuan; XSS tidak dieksekusi |
| SET-006 | P1 | Ubah notifikasi | Boolean tersimpan dan dibaca kembali |

## 14. Test cases — Bank soal guru

| ID | Pri | Skenario | Expected |
|---|---|---|---|
| QB-001 | P0 | Buat bank pada subject yang ditugaskan | Berhasil dan owner benar |
| QB-002 | P0 | Guru membuat bank untuk subject tanpa penugasan via API | Ditolak |
| QB-003 | P1 | Edit nama/tingkat bank | Tersimpan; `updated_at` berubah |
| QB-004 | P0 | Hapus bank kosong | Berhasil |
| QB-005 | P0 | Hapus bank berisi soal | Ditolak sampai soal dipindah/hapus |
| QB-006 | P0 | Buat PG 4 opsi dan kunci valid | Data options/correct_option benar |
| QB-007 | P0 | PG tanpa opsi/kunci | Validasi menolak |
| QB-008 | P1 | Tambah/hapus opsi | Minimal opsi tetap dipenuhi |
| QB-009 | P0 | Buat essay dengan answer key dan bobot | Data benar |
| QB-010 | P0 | Bobot 0/negatif/nonangka | Ditolak UI dan DB |
| QB-011 | P1 | Difficulty mudah/sedang/sulit | Mapping UI↔DB benar |
| QB-012 | P0 | Guru A baca/edit soal Guru B via REST | Ditolak RLS |
| QB-013 | P1 | Archive soal | Hilang dari daftar aktif, data tidak terhapus |
| QB-014 | P1 | Search/filter/type/difficulty/bank | Kombinasi hasil tepat |
| QB-015 | P1 | Unicode, rumus, simbol, teks panjang | Tersimpan dan dirender aman |
| QB-016 | P0 | HTML/script pada pertanyaan | Dirender sebagai teks, tidak dieksekusi |
| QB-017 | P1 | Soal sudah dipakai ujian | `usage_count` sinkron |
| QB-018 | P1 | 5.000 soal | Load/search tetap dalam target performa |

## 15. Test cases — Pembuatan dan pengelolaan ujian

| ID | Pri | Skenario | Expected |
|---|---|---|---|
| EXM-001 | P0 | Guru membuat ujian valid via wizard | RPC mengembalikan UUID; semua relasi terbentuk |
| EXM-002 | P0 | Verifikasi atomisitas dengan paksa satu question ID invalid | Tidak ada row exam/assignment parsial |
| EXM-003 | P0 | Pilih subject/class tanpa penugasan via RPC langsung | Ditolak |
| EXM-004 | P0 | Pakai soal milik guru lain | Ditolak |
| EXM-005 | P0 | Pakai archived question | Ditolak |
| EXM-006 | P0 | Tanpa soal | Ditolak |
| EXM-007 | P0 | Jadwal masa lalu | Ditolak server |
| EXM-008 | P0 | Durasi 0, negatif, 481 | Ditolak server |
| EXM-009 | P1 | Durasi 1 dan 480 | Diterima |
| EXM-010 | P0 | Kelas 32 siswa aktif + 1 nonaktif | Hanya 32 assignment dibuat |
| EXM-011 | P1 | Kelas kosong | Ujian dibuat dengan 0 peserta atau ditolak sesuai keputusan bisnis; hasil disepakati |
| EXM-012 | P0 | Kode akses lowercase/spasi | Disimpan normalized uppercase/trimmed |
| EXM-013 | P1 | Tanpa kode | Siswa dapat mulai tanpa prompt |
| EXM-014 | P1 | Shuffle/fullscreen toggle | Nilai tersimpan benar |
| EXM-015 | P0 | Dua klik submit wizard cepat | Hanya satu ujian dibuat |
| EXM-016 | P0 | Jaringan putus saat RPC | Tidak ada data parsial; UI dapat retry |
| EXM-017 | P1 | Ubah status sesuai lifecycle | Status dan dashboard konsisten |
| EXM-018 | P0 | Guru A update/delete ujian Guru B via REST | Ditolak RLS |
| EXM-019 | P1 | Ekspor CSV | Header, encoding UTF-8, isi/filter benar |
| EXM-020 | P1 | Search judul/subject/kelas/status | Hasil tepat |

Validasi atomisitas:

```sql
select e.id, e.title,
  count(distinct eq.question_id) as questions,
  count(distinct ea.student_id) as participants
from public.exams e
left join public.exam_questions eq on eq.exam_id = e.id
left join public.exam_assignments ea on ea.exam_id = e.id
where e.title like 'QA-%'
group by e.id, e.title;
```

## 16. Test cases — Dashboard siswa

| ID | Pri | Skenario | Expected |
|---|---|---|---|
| STD-001 | P0 | Siswa melihat assigned exam aktif | Tampil pada ujian tersedia |
| STD-002 | P0 | Siswa bukan assignment | Ujian tidak terlihat |
| STD-003 | P1 | Ujian masa depan | Tampil sebagai agenda, tidak bisa mulai |
| STD-004 | P1 | Ujian selesai belum pernah attempt | Tidak dapat dimulai |
| STD-005 | P0 | Attempt submitted/grading/final | Tidak tampil sebagai tersedia |
| STD-006 | P1 | Nilai final | Tampil pada hasil dengan angka benar |
| STD-007 | P1 | Nilai belum final | Status menunggu koreksi |
| STD-008 | P1 | Tidak punya kelas/ujian | Empty state benar |
| STD-009 | P1 | Online/offline event | Indikator berubah tepat |
| STD-010 | P0 | Siswa mencoba query assignment siswa lain | RLS menolak |

## 17. Test cases — Start attempt dan kode akses

| ID | Pri | Skenario | Expected |
|---|---|---|---|
| ATT-001 | P0 | Assigned student mulai ujian aktif tanpa kode | Attempt `in_progress` dibuat |
| ATT-002 | P0 | Non-assigned student panggil RPC | Ditolak |
| ATT-003 | P0 | Mulai sebelum `starts_at` | Ditolak |
| ATT-004 | P0 | Mulai setelah `ends_at` | Ditolak |
| ATT-005 | P0 | Kode benar | Attempt dimulai |
| ATT-006 | P0 | Kode salah/kosong | Ditolak; soal tidak dapat diambil |
| ATT-007 | P0 | Variasi kapital/spasi kode | Normalisasi bekerja |
| ATT-008 | P0 | Panggil `get_exam_questions` tanpa attempt | Tidak mengembalikan soal |
| ATT-009 | P0 | Panggil `get_exam_questions` dengan attempt final | Tidak mengembalikan soal |
| ATT-010 | P0 | Refresh attempt aktif | ID dan `started_at` sama; tidak membuat attempt kedua |
| ATT-011 | P0 | Dua tab start bersamaan | Unique constraint; satu attempt |
| ATT-012 | P0 | Start lagi setelah submitted/final | Ditolak |
| ATT-013 | P0 | Deadline = min(start+duration, ends_at) | Nilai RPC tepat |
| ATT-014 | P1 | Kode dengan karakter Unicode/ekstrem | Ditangani aman; tidak SQL injection |

## 18. Test cases — Ruang ujian dan autosave

| ID | Pri | Skenario | Expected |
|---|---|---|---|
| RUN-001 | P0 | Soal PG dan essay dimuat | Body/options tampil; correct answer tidak pernah ada di response |
| RUN-002 | P0 | Jawab PG | UI terpilih; row answers upsert tepat |
| RUN-003 | P0 | Ubah PG | Row sama diperbarui, bukan duplikat |
| RUN-004 | P0 | Ketik essay cepat | UI responsif; network debounce sekitar 600 ms |
| RUN-005 | P0 | Submit segera setelah ketik essay | Pending essay disinkronkan sebelum RPC submit |
| RUN-006 | P0 | Refresh setelah beberapa jawaban | Jawaban dipulihkan dari server |
| RUN-007 | P1 | Local cache berbeda dari server | Server menjadi sumber kebenaran setelah load |
| RUN-008 | P0 | Jaringan putus saat autosave | Pesan gagal sinkron terlihat; submit tidak mengklaim sukses |
| RUN-009 | P0 | Jaringan pulih lalu jawab ulang | Sinkronisasi berhasil |
| RUN-010 | P0 | Ubah answer setelah submitted via REST | Ditolak RLS |
| RUN-011 | P0 | Ubah answer setelah ends_at | Ditolak RLS |
| RUN-012 | P0 | Submit manual | Status berubah; local cache dibersihkan |
| RUN-013 | P0 | Waktu mencapai 00:00:00 | Submit otomatis tepat satu kali |
| RUN-014 | P0 | Submit RPC dipanggil dua kali | Panggilan kedua ditolak/idempotent, nilai tidak berubah |
| RUN-015 | P1 | Tandai ragu, navigasi soal | State visual benar selama session |
| RUN-016 | P1 | Essay hanya spasi | Dihitung belum terjawab |
| RUN-017 | P1 | Nomor soal/answered progress | Angka dan progress tepat |
| RUN-018 | P1 | Back/refresh/close tab | Browser warning tampil bila didukung |
| RUN-019 | P0 | Pindah tab/minimize | Integrity event dibuat dengan attempt/student benar |
| RUN-020 | P1 | Banyak visibility event cepat | Tidak merusak attempt; event dapat diaudit |
| RUN-021 | P0 | Session expire di tengah ujian | Error jelas; jawaban lokal tidak langsung dihapus |
| RUN-022 | P0 | Soal tanpa options akibat data rusak | Error terkontrol; tidak submit nilai salah |
| RUN-023 | P1 | Keyboard-only memilih opsi/navigasi | Dapat digunakan dan focus terlihat |
| RUN-024 | P1 | Mobile portrait/landscape | Konten dan tombol tidak tertutup |

## 19. Test cases — Scoring dan koreksi

### 19.1 Pilihan ganda

| ID | Pri | Skenario | Expected |
|---|---|---|---|
| SCR-001 | P0 | Semua PG benar dengan bobot sama | Nilai akhir 100 |
| SCR-002 | P0 | Semua salah | Nilai akhir 0 |
| SCR-003 | P0 | Sebagian benar bobot bervariasi | Rumus berbasis total bobot tepat |
| SCR-004 | P0 | Tidak menjawab sebagian | Soal kosong bernilai 0 |
| SCR-005 | P0 | Ujian tanpa essay | Submit langsung status `final` |
| SCR-006 | P0 | Ujian dengan essay | Submit status `submitted`, final_score null |
| SCR-007 | P0 | Manipulasi nilai dari browser | Tidak mungkin; correct option/scoring di server |
| SCR-008 | P0 | Attempt bukan milik user ke submit RPC | Ditolak |

### 19.2 Essay

| ID | Pri | Skenario | Expected |
|---|---|---|---|
| GRD-001 | P0 | Guru melihat jawaban essay ujian miliknya | Tampil dengan question, key, weight, siswa |
| GRD-002 | P0 | Guru lain membaca jawaban via API | Ditolak RLS |
| GRD-003 | P0 | Skor <0 atau >weight | Ditolak UI dan RPC |
| GRD-004 | P0 | Skor batas 0 dan maksimum | Diterima |
| GRD-005 | P1 | Simpan komentar kosong | Menjadi null |
| GRD-006 | P1 | Komentar Unicode/panjang | Aman dan konsisten |
| GRD-007 | P0 | Nilai satu dari beberapa essay | Attempt `grading`; final_score null |
| GRD-008 | P0 | Nilai essay terakhir | Attempt `final`; final_score/finalized_at terisi |
| GRD-009 | P0 | Perhitungan kombinasi PG+essay berbobot | Persentase benar hingga 2 desimal |
| GRD-010 | P0 | Guru mencoba grade answer bukan miliknya via RPC | Ditolak |
| GRD-011 | P0 | Admin mencoba grade via RPC | Ditolak sesuai separation policy |
| GRD-012 | P1 | Dua tab guru menilai jawaban sama | Hasil konsisten; konflik terdokumentasi |
| GRD-013 | P1 | Refresh setelah penilaian | Skor dan komentar pulih |

Contoh oracle nilai:

- PG: bobot total 6, poin benar 4.
- Essay: bobot total 4, skor diberikan 3.
- Total poin 7 dari 10.
- Expected `objective_score=4`, `essay_score=3`, `final_score=70.00`.

## 20. Test cases — Laporan dan ekspor

| ID | Pri | Skenario | Expected |
|---|---|---|---|
| RPT-001 | P0 | Ada attempt final | Siswa, kelas, ujian, nilai tampil benar |
| RPT-002 | P1 | Tidak ada hasil | Empty state; statistik tidak NaN |
| RPT-003 | P0 | Average/highest/lowest/pass rate | Sama dengan query database |
| RPT-004 | P1 | Nilai desimal | Format Indonesia benar |
| RPT-005 | P1 | CSV export | UTF-8 BOM, header, row, koma/quote aman |
| RPT-006 | P1 | Nama berisi koma/quote | CSV tetap valid |
| RPT-007 | P0 | Guru hanya melihat hasil ujian miliknya | RLS benar |
| RPT-008 | P0 | Admin membaca laporan sekolah | Sesuai hak read-only |
| RPT-009 | P1 | 10.000 hasil | Load/export dalam target performa atau pagination diwajibkan |

## 21. Security test plan

### 21.1 Authorization/RLS matrix

Uji setiap operasi menggunakan JWT role sebenarnya, bukan SQL Editor/service-role.

| Resource | Admin | Guru pemilik | Guru lain | Siswa sendiri | Siswa lain |
|---|---:|---:|---:|---:|---:|
| Profiles read | Semua | Staff/scope desain | Staff/scope desain | Sendiri | Tidak |
| Master data mutate | Ya | Tidak | Tidak | Tidak | Tidak |
| Question bank mutate | Tidak | Ya | Tidak | Tidak | Tidak |
| Exam mutate | Read-only | Ya | Tidak | Tidak | Tidak |
| Attempt read | Semua | Ujian sendiri | Tidak | Sendiri | Tidak |
| Answer mutate sebelum submit | Tidak | Grade own exam | Tidak | Sendiri | Tidak |
| Answer mutate setelah submit | Tidak | Grade essay own exam | Tidak | Tidak | Tidak |
| Audit log read | Ya | Tidak | Tidak | Tidak | Tidak |
| Settings mutate | Ya | Tidak | Tidak | Tidak | Tidak |

Test ID SEC-RLS-001 sampai SEC-RLS-030 dibuat per kombinasi operasi select/insert/update/delete pada setiap resource. Satu hasil tak terduga adalah P0/S0.

### 21.2 Security cases

| ID | Pri | Skenario | Expected |
|---|---|---|---|
| SEC-001 | P0 | Panggil RPC sensitif sebagai anon | Permission denied |
| SEC-002 | P0 | Ganti UUID exam/attempt/answer di request | Tidak memperoleh/mengubah data lain |
| SEC-003 | P0 | Cari `correct_option`/`answer_key` pada response siswa | Tidak ditemukan |
| SEC-004 | P0 | Cari service-role/secret pada bundle | Tidak ditemukan |
| SEC-005 | P0 | XSS payload pada nama, soal, komentar, sekolah | Tidak dieksekusi |
| SEC-006 | P0 | SQL injection string pada search/kode | Parameterized; tidak berpengaruh |
| SEC-007 | P1 | CSRF terhadap API Supabase | Token/session controls mencegah request tak sah |
| SEC-008 | P1 | Open redirect reset password | Hanya allowlisted domain |
| SEC-009 | P1 | Session token di URL/log | Tidak ada |
| SEC-010 | P1 | Security headers | CSP, HSTS, X-Content-Type-Options, Referrer-Policy tersedia di hosting |
| SEC-011 | P1 | Clickjacking | `frame-ancestors`/X-Frame-Options memblokir |
| SEC-012 | P1 | Cache halaman ujian setelah logout | Back tidak membuka data sensitif yang dapat digunakan |
| SEC-013 | P0 | Ubah clock lokal | Hak mulai/deadline tetap berdasarkan server |
| SEC-014 | P0 | Replay submit/grade/start RPC | Tidak menggandakan atau merusak data |
| SEC-015 | P1 | Brute-force kode akses | Rate-limit/logging strategy dinilai; defect jika tanpa mitigasi |
| SEC-016 | P1 | Abuse reset/login | Rate limit Supabase dikonfigurasi |
| SEC-017 | P1 | Dependency audit | Tidak ada critical vulnerability terbuka |
| SEC-018 | P0 | Verify function `search_path` | Seluruh SECURITY DEFINER memakai fixed search_path |

## 22. Concurrency dan race condition

| ID | Pri | Skenario | Expected |
|---|---|---|---|
| CON-001 | P0 | 2 request start attempt bersamaan | Satu attempt |
| CON-002 | P0 | 2 request create exam dari double-click | Satu ujian atau duplicate dicegah UI/idempotency |
| CON-003 | P0 | Autosave bersamaan dengan submit | Submit menunggu pending save; data terakhir masuk |
| CON-004 | P0 | Timeout bersamaan klik submit | Satu finalization; nilai konsisten |
| CON-005 | P1 | Dua tab menjawab soal sama | Last-write behavior tercatat dan tidak membuat row duplikat |
| CON-006 | P1 | Dua guru grade answer sama | Tidak korup; strategi optimistic lock direkomendasikan jika hasil tidak jelas |
| CON-007 | P0 | Admin nonaktifkan siswa saat ujian | Perilaku diputuskan dan diuji; session berikutnya ditolak |
| CON-008 | P1 | Soal diarchive saat ujian aktif | Snapshot/relasi ujian tetap dapat dikerjakan sesuai kebijakan |
| CON-009 | P1 | Kelas berubah setelah exam assignment dibuat | Peserta ujian tidak berubah diam-diam |

## 23. Performance dan load test

### 23.1 Target awal

| Metrik | Target |
|---|---|
| Login p95 | ≤2,5 detik |
| Dashboard p95 | ≤3 detik |
| Start attempt p95 | ≤2 detik |
| Load soal p95 | ≤2 detik untuk 100 soal |
| Autosave PG p95 | ≤800 ms |
| Autosave essay p95 | ≤1,5 detik setelah debounce |
| Submit p95 | ≤3 detik |
| Error rate | <1% selama load normal |
| Kehilangan jawaban | 0 |

### 23.2 Profil beban

| ID | Profil | Durasi | Acceptance |
|---|---|---|---|
| PERF-001 | 100 siswa login dalam 2 menit | 10 menit | Target p95 terpenuhi |
| PERF-002 | 500 siswa start ujian dalam 5 menit | 15 menit | Tidak ada duplicate attempt |
| PERF-003 | 500 siswa autosave tiap 20–40 detik | 60 menit | Error <1%, loss 0 |
| PERF-004 | 500 siswa submit dalam 2 menit | 10 menit | Semua status benar |
| PERF-005 | 50 guru membuka dashboard/laporan | 15 menit | Query stabil |
| PERF-006 | Soak 300 siswa | 3 jam | Tidak ada memory/error growth signifikan |
| PERF-007 | Spike 1.000 autosave bersamaan | 5 menit | Sistem pulih; tidak korup |

Gunakan data sintetis dan tool seperti k6. Jangan melakukan load test pada production tanpa persetujuan.

Pantau Supabase database CPU, connections, query latency, rate limit, Edge Function error, browser Network, dan Web Vitals.

## 24. Reliability, recovery, dan disaster test

| ID | Pri | Skenario | Expected |
|---|---|---|---|
| REL-001 | P0 | Browser crash setelah autosave | Jawaban server pulih |
| REL-002 | P0 | Wi-Fi putus 30 detik saat mengetik | UI memberi status; tidak mengklaim tersimpan |
| REL-003 | P0 | Supabase unavailable saat submit | Submit gagal jelas; local cache tetap ada |
| REL-004 | P1 | Service pulih | User dapat retry tanpa duplicate |
| REL-005 | P0 | Restore backup staging | RTO/RPO dicatat dan diverifikasi |
| REL-006 | P1 | Deploy frontend baru saat attempt aktif | Attempt/jawaban tetap kompatibel |
| REL-007 | P0 | Migration gagal di tengah deployment | Release dibatalkan/rollback sesuai runbook |
| REL-008 | P1 | Jam perangkat salah ±30 menit | Deadline server tetap benar |
| REL-009 | P1 | Storage browser penuh/disabled | Error cache tidak membuat app crash; server save tetap berjalan |

## 25. Accessibility

Target minimum: WCAG 2.1 AA untuk alur kritis.

| ID | Pri | Skenario | Expected |
|---|---|---|---|
| A11Y-001 | P0 | Seluruh ujian keyboard-only | Semua kontrol dapat dicapai/diaktifkan |
| A11Y-002 | P1 | Focus order | Logis dan terlihat |
| A11Y-003 | P1 | Screen reader login/wizard/runner | Label, heading, status dipahami |
| A11Y-004 | P1 | Kontras teks/tombol/status | Memenuhi AA |
| A11Y-005 | P1 | Zoom 200% | Tidak kehilangan fungsi/overlap kritis |
| A11Y-006 | P1 | Reflow 320px | Tidak ada scroll horizontal kritis |
| A11Y-007 | P1 | Error form | Terasosiasi dengan field dan diumumkan |
| A11Y-008 | P1 | Timer | Tidak mengganggu screen reader setiap detik |
| A11Y-009 | P1 | Status bukan hanya warna | Ada teks/icon/label |
| A11Y-010 | P1 | Reduced motion | Animasi tidak wajib untuk memahami UI |

Jalankan axe/Lighthouse dan manual NVDA (Windows) atau VoiceOver (Safari).

## 26. Usability/UAT

Libatkan minimal 2 admin, 3 guru, 2 pengawas, dan 10 siswa dengan variasi kemampuan digital.

| ID | Tugas | Target |
|---|---|---|
| UAT-001 | Admin membuat guru, siswa, kelas | ≥90% selesai tanpa bantuan |
| UAT-002 | Guru membuat bank dan 10 soal | ≥90% selesai; tidak ada salah konsep |
| UAT-003 | Guru menjadwalkan ujian | Median ≤5 menit |
| UAT-004 | Siswa login dan mulai ujian berkode | ≥95% berhasil tanpa bantuan |
| UAT-005 | Siswa navigasi, tandai, review, submit | ≥95% memahami status jawaban |
| UAT-006 | Guru koreksi essay | Median ≤30 detik/jawaban setelah familiar |
| UAT-007 | Admin/guru ekspor laporan | File ditemukan dan dipahami |
| UAT-008 | Pengawas menangani koneksi putus | Runbook dapat dilakukan |

Kumpulkan time-on-task, completion rate, error rate, pertanyaan, SUS score, dan komentar kualitatif.

## 27. Regression suite minimum

Jalankan pada setiap release candidate:

- CFG-002, CFG-003, CFG-006.
- AUTH-001 sampai AUTH-008.
- ADM-001, ADM-003, ADM-010, ADM-014, ADM-019.
- QB-001, QB-006, QB-009, QB-012.
- EXM-001 sampai EXM-008, EXM-010, EXM-015, EXM-016.
- ATT-001 sampai ATT-013.
- RUN-001 sampai RUN-014, RUN-019, RUN-021.
- SCR-001 sampai SCR-008.
- GRD-001 sampai GRD-011.
- RPT-001, RPT-003, RPT-005, RPT-007.
- SEC-001 sampai SEC-006, SEC-013, SEC-014, SEC-018.
- CON-001 sampai CON-004.
- A11Y-001, A11Y-002, A11Y-007.

## 28. Smoke test setelah deployment

Durasi target: ≤20 menit.

1. Buka domain HTTPS dan pastikan tidak ada error console kritis.
2. Login admin, cek dashboard, audit, dan settings read.
3. Login guru, buka bank soal dan daftar ujian.
4. Buat satu ujian smoke dengan satu soal dan satu siswa staging/smoke.
5. Login siswa smoke, mulai, jawab, dan submit.
6. Pastikan attempt final/nilai benar.
7. Hapus/arsipkan data smoke sesuai prosedur.
8. Pastikan monitoring tidak menunjukkan lonjakan error.

Jika salah satu langkah 1–6 gagal, rollback atau hentikan release.

## 29. Exit criteria

Release dapat diajukan go-live jika:

- 100% test P0 lulus.
- ≥95% test P1 lulus dan sisanya memiliki workaround serta persetujuan owner.
- Tidak ada defect S0/S1 terbuka.
- Tidak ada kebocoran lintas role/RLS.
- Load test target siswa sekolah lulus dengan buffer minimal 30%.
- UAT ditandatangani admin sekolah, perwakilan guru, QA Lead, Product Owner.
- Backup/restore dan incident runbook sudah diuji.
- Migration production, Edge Function, Auth URL, monitoring, dan backup sudah diverifikasi.
- Daftar peserta dan jadwal ujian telah direkonsiliasi dengan data sekolah.

## 30. Go/No-Go checklist H-1

| Item | Owner | Status/Evidence |
|---|---|---|
| Build SHA dikunci | Release Lead | |
| Migration `001`–`010` terverifikasi | DBA | |
| Backup terakhir berhasil | DBA | |
| Edge Function sehat | Backend | |
| RLS regression lulus | Security QA | |
| Load test lulus | Performance QA | |
| Akun siswa aktif dan kelas benar | Admin Sekolah | |
| Assignment ujian = daftar peserta | Guru/Pengawas | |
| Jadwal dan zona waktu benar | Pengawas | |
| Kode akses disiapkan aman | Pengawas | |
| Perangkat dan koneksi ruang siap | IT Sekolah | |
| Kanal bantuan dan eskalasi aktif | Support Lead | |
| Runbook insiden tersedia | Incident Commander | |
| Persetujuan GO | Product Owner | |

## 31. Kriteria No-Go otomatis

- Ada bukti siswa dapat membaca jawaban benar atau data siswa lain.
- Ada kemungkinan jawaban hilang tanpa pesan kegagalan.
- Timer/deadline salah atau dapat dimanipulasi lewat jam lokal.
- Submit menghasilkan status/nilai tidak konsisten.
- Migration belum lengkap atau backup belum tervalidasi.
- Error rate load test ≥1% pada beban target.
- Ada defect S0/S1 terbuka.
- Tidak ada petugas yang berwenang melakukan recovery saat jadwal ujian.

## 32. Defect workflow

1. Tester mencatat defect dengan test ID, build SHA, role, waktu, evidence, request ID.
2. QA Lead menentukan severity dan priority.
3. Developer melakukan root-cause dan fix pada branch terpisah.
4. Static check dan targeted test dijalankan.
5. QA melakukan retest dan regression area terkait.
6. Defect ditutup hanya dengan evidence baru.
7. S0/S1 memerlukan RCA singkat dan approval QA Lead.

Template defect:

```text
Judul:
Environment/build:
Test ID:
Severity/Priority:
Role dan test data:
Precondition:
Steps:
Expected:
Actual:
Evidence/log/request ID:
Frekuensi reproduksi:
Workaround:
```

## 33. Laporan hasil test

Laporan akhir minimal memuat:

- Build SHA dan migration version.
- Total planned/executed/pass/fail/blocked/not-run per priority.
- Defect per severity dan status.
- Hasil RLS/security matrix.
- Hasil performance p50/p95/p99 dan error rate.
- Hasil compatibility dan accessibility.
- Risiko residual dan workaround.
- Rekomendasi GO/CONDITIONAL GO/NO-GO.
- Tanda tangan QA Lead, Product Owner, Admin Sekolah, dan IT/DBA.

## 34. Rencana otomatisasi yang direkomendasikan

Belum ada test runner pada `package.json`. Implementasi bertahap:

### Tahap 1 — wajib

- Vitest + React Testing Library untuk form, route guard, timer, scoring presentation.
- Playwright untuk login, wizard ujian, student runner, koreksi, laporan.
- Supabase local CLI untuk migration dan RLS integration test.
- CI menjalankan install, lint, build, unit, integration, dan E2E smoke.

### Tahap 2

- k6 untuk start/autosave/submit load profile.
- axe-core melalui Playwright untuk accessibility regression.
- Dependency audit dan secret scanning.
- Migration test dari snapshot database staging.

### Target automation coverage

| Area | Target |
|---|---:|
| Auth dan route guard | 100% alur P0 |
| RPC/RLS | 100% matrix deny/allow kritis |
| Exam creation | 100% validasi P0 |
| Runner/autosave/submit | 100% alur P0 |
| Scoring | 100% kombinasi bobot/batas |
| Admin CRUD | ≥80% alur P0/P1 |
| Visual/a11y | Smoke seluruh route utama |

## 35. Traceability ringkas

| Risiko/Requirement | Test utama |
|---|---|
| Role separation | AUTH-004–006, SEC-RLS-* |
| Ujian atomik | EXM-001–003, EXM-016 |
| Kode dan jadwal server | ATT-003–007, SEC-013 |
| Kerahasiaan kunci | RUN-001, SEC-003 |
| Autosave tanpa loss | RUN-002–009, REL-001–004 |
| Lock setelah submit | RUN-010–014 |
| Scoring benar | SCR-001–008, GRD-007–009 |
| Auditability | ADM-019, RUN-019–020 |
| Skala ujian serentak | PERF-001–007 |
| Recovery | REL-001–009 |
| Kemudahan pengguna awam | UAT-001–008, A11Y-001–010 |

