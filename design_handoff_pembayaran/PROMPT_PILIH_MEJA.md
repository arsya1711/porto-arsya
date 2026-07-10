# Prompt Claude Code — Pilih Meja (POS)

---

## PROMPT

Implementasikan halaman **Pilih Meja** untuk aplikasi POS restoran. Kasir memilih meja sebelum memulai order baru.

---

### DESIGN TOKENS

```
Background halaman : #f4f5f7
Card background    : white
Font               : Plus Jakarta Sans (400, 500, 600, 700, 800)
Header height      : 56px
```

---

### HEADER

```
background: white, border-bottom: 1px solid #eee, padding: 0 20px, height: 56px

Kiri:
- Tombol kembali: 32×32px, border-radius 8px, bg #f4f5f7, icon chevron kiri stroke #555
  hover: bg #eee

- Judul "Pilih Meja": 16px, font-weight 700, color #111

Kanan (legenda status):
- display flex, gap 14px
- Setiap item: dot 8px + label 12px #666
    Tersedia: dot #16a34a
    Terisi  : dot #dc2626
    Reserved: dot #d97706
```

---

### GRID MEJA

padding: 20px, display grid, grid-template-columns: repeat(5, 1fr), gap: 12px

**Setiap tombol meja:**

```
border-radius: 14px
border: 1.5px solid [borderColor]
padding: 20px 12px 16px
display: flex, flex-direction: column, align-items: center, gap: 10px
cursor: pointer, position: relative
transition: filter 0.15s
hover: filter brightness(0.97)
```

**Status dot** (pojok kanan atas):
```
position: absolute, top: 10px, right: 10px
width: 7px, height: 7px, border-radius: 50%
```

**Icon meja** (SVG inline):
```
Gambar meja dari atas: top bar (lebar penuh) + 2 kaki + 4 kursi di bawah
Ukuran: 36×28px viewBox
Warna fill: iconColor
```

**Teks:**
```
Nomor meja: 18px, font-weight 800, line-height 1
Status label: 11px, font-weight 600, margin-top 3px
Jumlah tamu (jika ada): 10px, opacity 0.7
```

**Warna per status:**

| Status | cardBg | borderColor | iconColor | numColor | statusColor | dotColor |
|---|---|---|---|---|---|---|
| Tersedia | #f0fdf4 | #bbf7d0 | #16a34a | #14532d | #16a34a | #16a34a |
| Terisi | #fff5f5 | #fecaca | #dc2626 | #7f1d1d | #dc2626 | #dc2626 |
| Reserved | #fffbeb | #fde68a | #d97706 | #78350f | #d97706 | #d97706 |

---

### DATA MEJA (12 meja)

| No | Status | Tamu |
|---|---|---|
| 1 | Tersedia | - |
| 2 | Terisi | 3 tamu |
| 3 | Tersedia | - |
| 4 | Reserved | 19.00 |
| 5 | Tersedia | - |
| 6 | Terisi | 2 tamu |
| 7 | Tersedia | - |
| 8 | Terisi | 5 tamu |
| 9–12 | Tersedia | - |

---

### FOOTER BAR

```
background: white, border-top: 1px solid #eee, padding: 12px 20px
display: flex, justify-content: space-between

Kiri: "12 meja · 8 tersedia · 3 terisi · 1 reserved"
  Angka tersedia: color #16a34a, font-weight 600
  Angka terisi  : color #dc2626, font-weight 600
  Angka reserved: color #d97706, font-weight 600

Kanan: "Tap meja untuk mulai order" — 12px, color #bbb
```

---

### BEHAVIOUR

- Tap meja berstatus **Tersedia** → navigasi ke halaman Proses Pembayaran dengan nomor meja terpilih
- Tap meja **Terisi** → tampilkan order aktif meja tersebut
- Tap meja **Reserved** → tampilkan info reservasi
- Animasi masuk halaman: `opacity 0→1`, 0.2s ease
