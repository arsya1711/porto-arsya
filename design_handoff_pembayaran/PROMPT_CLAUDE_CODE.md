# Prompt untuk Claude Code — Layar Proses Pembayaran (POS)

Salin dan tempel prompt di bawah ini langsung ke Claude Code.

---

## PROMPT

Implementasikan layar **Proses Pembayaran** untuk aplikasi POS restoran kami. Ini adalah high-fidelity design handoff — ikuti spesifikasi visual dan perilaku di bawah ini secara presisi.

---

### LAYOUT

Layar terbagi dua kolom (desktop/tablet landscape):
- **Kiri** (flex: 1): Ringkasan order + pilihan metode pembayaran + tombol bagi tagihan
- **Kanan** (lebar tetap 340px): Panel numpad untuk input uang diterima

Background halaman: `#f4f5f7`
Font: Plus Jakarta Sans (400, 500, 600, 700, 800)

---

### HEADER

- Background: `white`, border-bottom: `1px solid #eee`, tinggi: 56px, padding horizontal: 20px
- Tombol kembali (icon chevron kiri), ukuran 32×32px, border-radius 8px, bg `#f4f5f7`
- Judul: "Proses Pembayaran", font-size 16px, font-weight 700
- Badge nama meja di kanan: bg `#f0fdf4`, border `1px solid #bbf7d0`, border-radius 20px, padding 5px 12px, teks "Meja 3", warna `#16a34a`, font-size 12px, font-weight 600

---

### PANEL KIRI

#### 1. Ringkasan Order
Card: bg `white`, border-radius 14px, box-shadow `0 1px 3px rgba(0,0,0,0.05)`

Header card: padding 14px 18px, border-bottom `1px solid #f5f5f5`, teks "Ringkasan Order" font-size 13px font-weight 700

Setiap item order:
- Badge qty: 22×22px, border-radius 6px, bg `#fef3f2`, angka warna `#dc2626`, font-size 11px font-weight 700
- Nama item: font-size 14px, warna `#333`
- Harga: font-size 14px, font-weight 600, warna `#111`, font-variant-numeric tabular-nums

Baris total (subtotal, pajak, service): font-size 13px, label warna `#888`, nilai warna `#555`
Baris Total akhir: label font-size 15px font-weight 700, nilai font-size 18px font-weight 800 warna `#dc2626`

Kalkulasi pajak & service:
- Subtotal = jumlah semua item
- Pajak = Subtotal × 10%
- Service = Subtotal × 2%
- Total = Subtotal + Pajak + Service

#### 2. Metode Pembayaran
Card: bg `white`, border-radius 14px, padding 14px 18px
Grid 3 kolom, gap 10px

5 metode: **Tunai, QRIS, Debit, E-Wallet, Transfer**

Setiap tombol metode:
- Default: bg `white`, border `1.5px solid #eee`, label warna `#555`, icon warna `#888`
- **Selected**: bg `#fef2f2`, border `1.5px solid #dc2626`, label warna `#dc2626`, icon warna `#dc2626`
- Padding 16px 10px, border-radius 12px, layout flex column center, gap 8px
- Icon SVG ukuran 22×22, teks label font-size 13px font-weight 600

#### 3. Tombol Bagi Tagihan
- Width 100%, bg `white`, border `1.5px solid #e5e5e5`, border-radius 12px, padding 13px
- Teks "Bagi Tagihan", font-size 13px font-weight 600, warna `#666`
- Icon shuffle/split di kiri
- Hover: bg `#f5f5f5`

---

### PANEL KANAN (Numpad)

Card: bg `white`, border-radius 14px, flex column, overflow hidden

#### Area Display
Padding 16px, border-bottom `1px solid #f5f5f5`

**Diterima:**
- Label: "DITERIMA", font-size 11px font-weight 600, warna `#999`, uppercase, letter-spacing 0.5px
- Nilai: font-size 26px font-weight 800, warna `#111`, format Rupiah (contoh: "Rp 25.000")
- Default tampil "Rp 0"

**Kotak Kembalian/Kurang:**
- Border-radius 10px, padding 10px 14px
- Jika uang diterima ≥ total → **Kembalian**: bg `#f0fdf4`, border `1.5px solid #bbf7d0`, label+nilai warna `#16a34a`
- Jika uang diterima < total → **Kurang**: bg `#fff5f5`, border `1.5px solid #fecaca`, label+nilai warna `#dc2626`
- Label font-size 11px font-weight 600 uppercase
- Nilai font-size 22px font-weight 800

#### Quick Amount Buttons
Grid 4 kolom, gap 6px, padding 10px 12px, border-bottom `1px solid #f5f5f5`
Nilai: Rp 25.000 / Rp 30.000 / Rp 40.000 / Rp 50.000
Style: bg `#f4f5f7`, border `1px solid #eee`, border-radius 8px, padding 8px 4px, font-size 11px font-weight 700, warna `#444`
Tap → set nilai diterima langsung ke angka tersebut

#### Numpad Grid
Grid 3 kolom, gap 1px, background grid `#f0f0f0` (jadi garis pemisah tipis)
Tombol: `7 8 9 / 4 5 6 / 1 2 3 / 000 0 ⌫`

Tombol angka: bg `white`, font-size 18px font-weight 700, warna `#111`
Tombol ⌫ (backspace): bg `#fff1f1`, icon SVG backspace, warna `#dc2626`
Perilaku input:
- Angka ditambahkan ke kanan (string concatenation)
- `000` menambahkan tiga nol
- `⌫` menghapus karakter terakhir
- Leading zeros dihapus otomatis

#### Tombol Bayar
Padding 12px (wrapper), tombol: width 100%, padding 16px, border-radius 12px, font-size 15px font-weight 700

- **Disabled** (uang diterima < total): bg `#e5e5e5`, warna `#aaa`
- **Active** (uang diterima ≥ total): bg `#16a34a`, warna `white`
- Teks: "Bayar Rp {total}" (total diformat Rupiah)
- Icon centang di kiri

---

### STATE MANAGEMENT

```typescript
interface PaymentState {
  selectedMethod: 'tunai' | 'qris' | 'debit' | 'ewallet' | 'transfer';
  receivedAmount: number;   // dalam rupiah (integer)
  orderItems: OrderItem[];
  tableNumber: number;
}

interface OrderItem {
  qty: number;
  name: string;
  price: number;
}

// Derived:
const subtotal = orderItems.reduce((s, i) => s + i.qty * i.price, 0);
const tax = Math.round(subtotal * 0.10);
const service = Math.round(subtotal * 0.02);
const total = subtotal + tax + service;
const change = receivedAmount - total;
const isReady = receivedAmount >= total;
```

---

### ANIMASI & TRANSISI

- Masuk ke layar: `opacity 0→1` + `translateY 24px→0`, durasi 0.2s ease
- Hover tombol metode pembayaran: `filter: brightness(0.97)`, 0.15s
- Tombol bayar background change: `transition: background 0.15s`

---

### FORMAT RUPIAH

```javascript
function formatRupiah(amount: number): string {
  return 'Rp ' + amount.toLocaleString('id-ID');
}
// Output: "Rp 22.400" (gunakan titik sebagai pemisah ribuan)
```

---

### REFERENSI FILE DESAIN

File HTML prototype ada di project ini: `POS App.dc.html`
Layar pembayaran aktif saat `screen === 'pembayaran'` di state komponen.
Buka file tersebut di browser untuk melihat prototype interaktif langsung.
