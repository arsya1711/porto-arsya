# Panduan Logo Putih AWExam

Website `porto-arsya` menggunakan varian logo putih, sedangkan aplikasi Flutter `ujianaw` tetap menggunakan logo biru transparan.

## Spesifikasi web

- Aset: `public/logo-white.png`.
- Format: PNG RGBA, background transparan.
- Resolusi: 1024 × 1024 piksel.
- Warna mark: putih solid `#FFFFFF`.
- Tanpa teks, bayangan, outline, glow, gradient, atau watermark.

## Aturan tampilan

- Pada sidebar, loading tile gelap, dan header runner, logo putih dapat ditampilkan langsung.
- Pada student header dan mobile login yang berlatar terang, logo putih harus ditempatkan pada tile biru agar tetap terbaca.
- Favicon dan Apple touch icon tetap memakai logo biru karena varian putih transparan dapat menghilang pada background tab/perangkat yang terang.
- Logo sekolah yang diunggah melalui pengaturan tidak boleh diganti oleh varian AWExam.
- Pertahankan rasio aspek dan padding; jangan meregangkan mark.
- Halaman login menampilkan nama sekolah `Mts Alhidayah Wattaqwa` di bawah identitas logo pada tampilan desktop dan mobile.

## Verifikasi

Setiap perubahan branding web harus diperiksa dengan:

```bash
npm run build
npm run lint
```

Lakukan review visual pada login desktop/mobile, sidebar, student header, loading state, dan runner ujian sebelum deployment.
