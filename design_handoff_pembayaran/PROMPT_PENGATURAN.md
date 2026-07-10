# Prompt untuk Claude Code — Halaman Pengaturan (POS)

Salin dan tempel prompt di bawah ini langsung ke Claude Code.

---

## PROMPT

Implementasikan halaman **Pengaturan** beserta semua sub-halaman untuk aplikasi POS restoran kami. Ikuti spesifikasi visual dan perilaku di bawah ini secara presisi. Desain ini mengutamakan tampilan profesional dengan palet warna minimal (hitam/putih/abu-abu).

---

### DESIGN TOKENS

```
Background halaman : #f5f5f5
Card background    : white
Border             : #ebebeb / #f0f0f0 (lebih tipis dalam card)
Teks primer        : #111
Teks sekunder      : #999
Teks tersier       : #bbb
Aksen primer       : #111 (toggle on, tombol Simpan)
Font               : Plus Jakarta Sans (400, 500, 600, 700)
Border-radius card : 12px
```

---

### KOMPONEN TOGGLE

Digunakan di banyak halaman. Buat sebagai komponen reusable:

```
Ukuran track  : 44×26px, border-radius 13px
Ukuran thumb  : 20×20px, border-radius 50%, background white
Shadow thumb  : 0 1px 3px rgba(0,0,0,0.2)
Posisi thumb  : left 3px (OFF) → left 21px (ON), transition 0.2s
Warna track   : #e0e0e0 (OFF) → #111 (ON), transition 0.2s
```

---

### HEADER PATTERN (semua sub-halaman)

```
background: white
border-bottom: 1px solid #ebebeb
height: 54px
padding: 0 24px
position: sticky, top 0, z-index 10

Isi:
- Tombol kembali (chevron kiri): 30×30px, border-radius 6px, bg transparent → hover #f5f5f5
- Judul: 17px, font-weight 700, color #111, letter-spacing -0.3px
- [Opsional] Tombol Simpan di kanan: padding 7px 16px, border-radius 8px, bg #111, text white, 13px 600
```

---

### HALAMAN 1: PENGATURAN (daftar utama)

Route: `/kasir/pengaturan`

Layout: `max-width 680px`, `margin 0 auto`, `padding 20px 16px 40px`

**Section header label:**
```
font-size: 11px, font-weight: 700, color: #999
text-transform: uppercase, letter-spacing: 0.8px
margin-bottom: 8px, padding: 0 4px
```

**Card list:**
- background white, border-radius 12px, border `1px solid #ebebeb`, overflow hidden
- Setiap row: padding `14px 16px`, border-bottom `1px solid #f0f0f0` (kecuali terakhir), hover `#fafafa`

**Row item:**
```
- Icon container: 36×36px, border-radius 8px, background #f5f5f5, flex center, margin-right 14px
- Icon: SVG 17×17, stroke #555, stroke-width 1.8, fill none
- Label: 14px, font-weight 600, color #111
- Deskripsi: 12px, color #999, margin-top 1px
- Chevron: SVG 14×14, stroke #ccc
```

**Section OPERASIONAL:**
| Label | Deskripsi | Route tujuan |
|---|---|---|
| Order Online | Terima pesanan dari QR self-order | /pengaturan/order-online |
| Struk & Biaya | Tampilan struk, service charge | /pengaturan/struk-biaya |
| Pajak | Pengaturan PPN & pajak | /pengaturan/struk-biaya |
| Perangkat | Printer kasir/dapur, koneksi, autoprint | /pengaturan/perangkat |
| Notifikasi Suara | Bunyi saat ada pesanan baru | /pengaturan/notifikasi |
| Pembayaran Nontunai | Metode pembayaran yang aktif | /pengaturan/pembayaran |
| Promo | Kelola promo & voucher | /pengaturan/promo |

**Section AKUN:**
| Label | Deskripsi | Route tujuan |
|---|---|---|
| Info Outlet | Nama, alamat, telepon | /pengaturan/info-outlet |
| Password & PIN | Ganti PIN Anda | /pengaturan/password-pin |

Footer: teks "Versi 2.4.1", font-size 12px, color #ccc, center.

---

### HALAMAN 2: ORDER ONLINE

Route: `/kasir/pengaturan/order-online`
Header: ← Order Online (tanpa tombol Simpan)

**Card tunggal** (white, border-radius 12px, border `1px solid #ebebeb`):
- Row dengan icon (shopping bag), label "Terima pesanan online", status "Aktif"/"Nonaktif" (font-weight 500, color #111 jika aktif / #bbb jika nonaktif), dan Toggle di kanan

**Teks deskripsi** di bawah card (font-size 12px, color #aaa, line-height 1.6):
> "Bila aktif, pelanggan bisa memesan sendiri lewat QR di meja. Matikan saat outlet tutup atau dapur penuh."

---

### HALAMAN 3: STRUK & BIAYA

Route: `/kasir/pengaturan/struk-biaya`
Header: ← Struk & Biaya + tombol **Simpan**

**Section "TAMPILAN STRUK"** — card dengan toggle rows:

| Label | Default |
|---|---|
| Tampilkan Logo | ON |
| Nama Outlet | ON |
| Alamat | ON |
| Telepon | ON |
| No Nota | ON |
| Waktu | OFF |
| Kasir | ON |
| Customer | ON |
| Nomor Meja | ON |

Di bawah toggle list, tambahkan textarea:
```
placeholder: "Catatan kaki struk (footer)"
rows: 2
padding: 10px 12px
background: #f8f8f8
border: 1.5px solid #ebebeb
border-radius: 8px
font-size: 13px
```

**Section "PAJAK & SERVICE CHARGE"** — card terpisah:
- Toggle "Pajak Aktif" (default ON)
- Toggle "Harga Sudah Termasuk Pajak" (default OFF)
- Grid 2 kolom: field "NAMA PAJAK" (value: PPN) + "PAJAK (%)" (value: 10)
- Field "SERVICE CHARGE (%)" (value: 2)

Field label style: `font-size 11px, font-weight 600, color #999, letter-spacing 0.4px, uppercase, margin-bottom 6px`
Field input style: `border: none, background: transparent, font-size 14px, font-weight 600, color #111, width 100%`

---

### HALAMAN 4: NOTIFIKASI SUARA

Route: `/kasir/pengaturan/notifikasi`
Header: ← Notifikasi Suara (tanpa Simpan)

**Card tunggal**: icon lonceng + label "Suara notifikasi pesanan" + status + Toggle

**Teks deskripsi**:
> "Bunyikan suara & getar saat ada pesanan baru masuk. Pengaturan ini berlaku untuk perangkat ini saja."

---

### HALAMAN 5: PEMBAYARAN NON-TUNAI

Route: `/kasir/pengaturan/pembayaran`
Header: ← Pembayaran Non-Tunai + tombol **Simpan**

**Card tunggal** dengan rows:

| Label | Keterangan |
|---|---|
| Tunai | Teks "Selalu aktif" di kanan (bukan toggle), warna #bbb, 12px |
| QRIS | Toggle (default ON) |
| Kartu Debit | Toggle (default ON) |
| Kartu Kredit | Toggle (default OFF) |
| E-Wallet | Toggle (default ON) |
| Transfer Bank | Toggle (default ON) |

---

### HALAMAN 6: PROMO

Route: `/kasir/pengaturan/promo`
Header: ← Promo (tanpa Simpan)

**Card list** promo yang ada. Setiap row:
- Icon tag di container 36×36 bg #f5f5f5
- Label promo (bold 14px)
- Sub-label: tipe · nilai (12px #999)
- Chevron kanan

**FAB (Floating Action Button)** di kanan bawah:
```
position: fixed, bottom: 24px, right: 24px
background: #111, color: white
border-radius: 50px, padding: 14px 20px
font-size: 14px, font-weight: 600
box-shadow: 0 4px 16px rgba(0,0,0,0.2)
label: "+ Tambah Promo"
hover: background #333
```

---

### HALAMAN 7: INFO OUTLET

Route: `/kasir/pengaturan/info-outlet`
Header: ← Info Outlet + tombol **Simpan**

**Card form** (white, border-radius 12px):

Fields (stacked, border-bottom `1px solid #f0f0f0` antar field):
- NAMA OUTLET (value: Time 420s)
- ALAMAT (placeholder)
- TELEPON (placeholder, type tel)
- KOTA (placeholder)

Setiap field: label uppercase 11px #999 + input borderless transparent.

---

### HALAMAN 8: PASSWORD & PIN

Route: `/kasir/pengaturan/password-pin`
Header: ← Password & PIN + tombol **Simpan**

**Card form**:
- Field "PIN BARU (4 DIGIT)": type password, maxlength 4, font-size 20px, letter-spacing 8px
- Field "KONFIRMASI PIN": type password, maxlength 4

**Teks deskripsi**:
> "PIN digunakan untuk membuka akses kasir. Pastikan Anda mengingatnya."

---

### STATE MANAGEMENT

```typescript
interface PengaturanState {
  // Toggle states
  orderOnline: boolean;       // default true
  notifikasi: boolean;        // default true
  tampilLogo: boolean;        // default true
  namaOutlet: boolean;        // default true
  alamat: boolean;            // default true
  telepon: boolean;           // default true
  noNota: boolean;            // default true
  waktu: boolean;             // default false
  kasir: boolean;             // default true
  customer: boolean;          // default true
  nomorMeja: boolean;         // default true
  pajakAktif: boolean;        // default true
  hargaIncludePajak: boolean; // default false
  qris: boolean;              // default true
  kartuDebit: boolean;        // default true
  kartuKredit: boolean;       // default false
  eWallet: boolean;           // default true
  transferBank: boolean;      // default true
}
```

---

### ANIMASI & TRANSISI

- Masuk ke sub-halaman: `translateX(16px) → translateX(0)` + `opacity 0→1`, durasi 0.15s ease
- Hover list row: background `#fafafa`, transition 0.1s
- Toggle: background + thumb position, transition 0.2s

---

### FILE REFERENSI

Prototype interaktif lengkap tersedia di: `Pengaturan.dc.html`
Semua 8 layar dapat diakses melalui nav bar di bagian bawah prototype.
