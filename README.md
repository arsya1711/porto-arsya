# Ruang Ujian Siswa

Aplikasi Flutter untuk siswa berdasarkan PRD Aplikasi Ujian Sekolah dan Spesifikasi Mobile v1.1.

## Menjalankan aplikasi

```bash
flutter pub get
flutter run
```

Login demo sudah terisi otomatis:

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
- Review jawaban dan submit online/offline
- Riwayat nilai dan profil siswa

Data saat ini berasal dari `DemoRepository`. Struktur state dan model dipisahkan agar repository dapat diganti dengan Supabase dan penyimpanan lokal Drift pada tahap integrasi berikutnya.

## Verifikasi

```bash
flutter analyze
flutter test
flutter build apk --debug
```
