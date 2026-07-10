# Time 420s POS Web

Web POS restoran berbasis React + TypeScript, dibangun dari dokumen handoff pada `design_handoff_pembayaran`. Proyek ini hanya berisi aplikasi web; tidak ada implementasi Flutter.

## Fitur

- Dashboard operasional responsif
- Pemilihan dan status meja
- Pembayaran tunai/nontunai, numpad, pajak dan service charge
- Shift kasir, kas masuk/keluar, tutup shift, dan riwayat
- Pengaturan order online, struk, pembayaran, outlet, perangkat, dan PIN
- CRUD promo
- Sinkronisasi Supabase dengan fallback `localStorage` untuk mode demo

## Menjalankan lokal

Prasyarat: Node.js 20 atau lebih baru.

```bash
npm install
copy .env.example .env.local
npm run dev
```

Tanpa `.env.local`, aplikasi tetap berjalan dalam mode demo dan menyimpan perubahan di browser.

## Menghubungkan Supabase

1. Buat project di Supabase.
2. Jalankan isi `supabase/migrations/001_initial_schema.sql` melalui SQL Editor.
3. Salin Project URL dan anon key ke `.env.local`:

```env
VITE_SUPABASE_URL=https://PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=ANON_KEY
```

4. Restart server pengembangan.

Migration memakai kebijakan akses anon agar instalasi POS satu outlet dapat langsung digunakan. Untuk deployment multi-outlet, tambahkan Supabase Auth, kolom `outlet_id`, dan ganti policy dengan policy berbasis user/outlet sebelum dipublikasikan.

## Perintah

```bash
npm run dev      # development server
npm run build    # type-check dan production build
npm run lint     # lint source
npm run preview  # preview hasil build
```
