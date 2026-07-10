# Prompt Claude Code — Shift Kasir

---

## PROMPT

Implementasikan halaman **Shift Kasir** untuk aplikasi POS restoran. Ini mencakup layar utama shift aktif, riwayat shift, dan 4 modal aksi.

---

### DESIGN TOKENS

```
Background halaman : #f4f5f7
Card background    : white
Border             : 1px solid #eee
Teks primer        : #111
Teks sekunder      : #555
Teks tersier       : #999
Aksen hijau        : #16a34a (kas masuk, nilai positif)
Aksen merah        : #dc2626 (tutup shift, nilai negatif)
Font               : Plus Jakarta Sans (400, 500, 600, 700)
Border-radius card : 16px
```

---

### HEADER

```
background: white
border-bottom: 1px solid #eee
height: 56px, padding: 0 20px
max-width: 760px, margin: 0 auto

Isi:
- Hamburger menu (3 garis): width 18/13/18px, height 2px, gap 4px, color #666
- Judul "Shift Kasir": 16px, font-weight 700, color #111, letter-spacing -0.2px
```

---

### LAYAR UTAMA

max-width: 760px, margin: 0 auto, padding: 24px 20px 0

#### CARD SHIFT AKTIF

background white, border-radius 16px, box-shadow `0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.05)`, overflow hidden, margin-bottom 24px

**Bar atas (dark):**
```
background: #1a1a1a, padding: 14px 20px

Kiri:
- Dot animasi: 8px, border-radius 50%, background #22c55e
  animation: pulse ring 2s infinite (box-shadow 0→5px rgba(34,197,94,0) repeat)
- Label "Shift Berjalan": 13px, font-weight 600, color #22c55e, letter-spacing 0.3px

Kanan (pill timer):
- background: rgba(255,255,255,0.1), padding 5px 11px, border-radius 20px
- Icon jam + elapsed time: 12px, font-weight 600, color rgba(255,255,255,0.7)
- Timer live: hitung dari waktu mulai shift, update tiap 30 detik
```

**Stats row:**
```
grid 2 kolom, padding 18px 20px, border-bottom 1px solid #f0f0f0

Kiri — "Mulai":
  label: 11px 600 #999 uppercase letter-spacing 0.5px, margin-bottom 4px
  nilai: 15px 600 #111 → contoh: "10:01, 6 Jul 2026"

Kanan — "Kas Awal":
  border-left: 1px solid #f0f0f0, padding-left 20px
  label + nilai sama style
```

**Tombol Kas Masuk / Kas Keluar:**
```
grid 2 kolom, border-bottom 1px solid #f0f0f0

Kas Masuk:
  padding 16px, bg white, border-right 1px solid #f0f0f0
  color #16a34a, font-size 14px, font-weight 600
  icon plus (+) SVG kiri
  hover: bg #f0fdf4

Kas Keluar:
  padding 16px, bg white
  color #dc2626, font-size 14px, font-weight 600
  icon minus (-) SVG kiri
  hover: bg #fff5f5
```

**Tombol Tutup Shift:**
```
margin: 14px 16px, width calc(100% - 32px)
background #dc2626, color white
padding 15px, border-radius 10px
font-size 14px, font-weight 700
icon lingkaran-minus kiri
hover: bg #b91c1c
```

---

#### RIWAYAT 7 HARI TERAKHIR

Label section: 12px, font-weight 700, color #888, uppercase, letter-spacing 0.8px, margin-bottom 14px

Card list: background white, border-radius 16px, box-shadow `0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)`, overflow hidden

Setiap row (klik → buka modal detail):
```
display: flex, align-items: center, padding: 14px 20px
border-bottom: 1px solid #f5f5f5, cursor pointer
hover: background #fafafa

- Tanggal: width 48px, flex-shrink 0, 13px 600 #999
- Rentang waktu: flex 1, 14px #555, font-variant-numeric tabular-nums
- Badge nilai: padding 4px 11px, border-radius 20px
    Positif: bg #f0fdf4, text #16a34a
    Negatif: bg #fff1f1, text #dc2626
- Chevron kanan: 14px, stroke #ccc
```

Data contoh:
| Tanggal | Waktu | Nilai |
|---|---|---|
| 5 Jul | 09:39 – 14:57 | -Rp 281.560 |
| 5 Jul | 05:27 – 06:23 | +Rp 810.000 |
| 5 Jul | 05:24 – 12:25 | +Rp 8.100.000 |
| 4 Jul | 16:43 – 12:24 | +Rp 89.640.480 |
| 3 Jul | 11:04 – 23:38 | +Rp 866.400 |
| 2 Jul | 13:50 – 21:36 | +Rp 706.360 |
| 2 Jul | 08:17 – 20:50 | +Rp 47.000 |
| 1 Jul | 15:22 – 22:22 | +Rp 700.000 |

---

### MODAL PATTERN (semua modal)

```
Overlay: position fixed, inset 0, background rgba(0,0,0,0.45), z-index 100
  display flex, align-items center, justify-content center, padding 20px
  animation: fade-in 0.2s ease
  Klik overlay → tutup modal

Panel: max-width 480px, width 100%, background white, border-radius 18px
  animation: slide-up 0.22s ease (translateY 24px → 0)
  Klik panel → stopPropagation
```

**Header modal:**
```
Icon container: 34×34px, border-radius 10px
Judul: 19px, font-weight 700, color #111
```

**Input field (Nominal):**
```
Wrapper: bg #fafafa, border 1.5px solid [aksen warna], border-radius 10px, overflow hidden, flex row
Prefix "Rp": padding 0 13px, 14px 600 #999, border-right 1.5px solid #eee
Input: flex 1, padding 14px 13px, 15px 600 #111, type number, bg transparent, no border
```

**Input field (Catatan):**
```
bg #fafafa, border 1.5px solid #eee, border-radius 10px
padding 13px, 14px color #111, placeholder "Opsional"
```

**Label field:**
```
11px, font-weight 600, color #999, uppercase, letter-spacing 0.5px, margin-bottom 7px
```

**Footer tombol:**
```
grid 2 kolom (1fr 2fr), gap 10px

Batal: bg white, border 1.5px solid #e5e5e5, color #666, 14px 600
       hover: bg #f5f5f5
Aksi:  bg [aksen], color white, 14px 700
       hover: bg [aksen gelap]
```

---

### MODAL 1: KAS MASUK

Header: icon + (`bg #f0fdf4`) + judul "Kas Masuk"
Deskripsi: "Tambahan kas ke laci (mis. tambah modal)."
Input nominal: border aksen `#16a34a`
Tombol aksi: bg `#16a34a`, hover `#15803d`, label "Simpan Kas Masuk"

---

### MODAL 2: KAS KELUAR

Header: icon minus (`bg #fff5f5`) + judul "Kas Keluar"
Deskripsi: "Kas keluar dari laci (mis. bayar galon/ojek)."
Input nominal: border aksen `#dc2626`
Tombol aksi: bg `#dc2626`, hover `#b91c1c`, label "Simpan Kas Keluar"

---

### MODAL 3: TUTUP SHIFT

Header: icon lingkaran-minus (`bg #fff5f5`) + judul "Tutup Shift"
Info bar kas awal: bg `#fafafa`, border-radius 8px, padding 10px 14px
  label "Kas awal:" 13px #999 + nilai 13px 700 #333

Input: "Kas Akhir (Rp)" + Catatan
Tombol aksi: bg `#dc2626`, label "Tutup Shift"

---

### MODAL 4: DETAIL SHIFT

Trigger: klik baris riwayat

**Header modal (dark bar):**
```
background: #1a1a1a, padding 18px 20px
Sub-label: 11px 600 #888 uppercase "Detail Shift"
Judul: tanggal + rentang waktu, 16px 700 white
Tombol tutup: 30×30px, border-radius 50%, bg rgba(255,255,255,0.1), icon X white
```

**Stats 3 kolom** (border-bottom 1px #f0f0f0):
- Durasi | Kas Awal | Kas Akhir
- label 11px 600 #999 uppercase, nilai 14px 700 #111

**Daftar Transaksi:**
Label section: "TRANSAKSI", 11px 700 #bbb uppercase, margin-bottom 12px

Setiap transaksi row:
```
- Icon container 28×28px, border-radius 8px
    Kas Masuk: bg #f0fdf4, icon + warna #16a34a
    Kas Keluar: bg #fff1f1, icon - warna #dc2626
- Label: 13px 600 #222
- Waktu: 12px #aaa
- Nominal: 13px 700, font-variant tabular-nums
    Positif: #16a34a | Negatif: #dc2626
```

**Footer selisih:**
```
background: #fafafa, padding 16px 20px
Label "Selisih Bersih": 14px 600 #666
Nilai: 16px 700, warna sesuai positif/negatif
```

---

### STATE & LIVE TIMER

```typescript
interface ShiftKasirState {
  showKasMasuk: boolean;
  showKasKeluar: boolean;
  showTutupShift: boolean;
  showDetail: boolean;
  selectedShift: ShiftDetail | null;
  elapsed: string; // "3j 21m"
}

// Timer: update setiap 30 detik
// Format: "${h}j ${m}m" jika h > 0, else "${m}m"
const startTime = new Date('2026-07-06T10:01:00');
```
