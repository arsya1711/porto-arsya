# Prompt Claude Code — Order Online (Sub-halaman Pengaturan)

---

## PROMPT

Implementasikan sub-halaman **Order Online** dalam menu Pengaturan aplikasi POS restoran.

---

### DESIGN TOKENS

```
Background halaman : #f5f5f5
Card background    : white
Border card        : 1px solid #ebebeb
Teks primer        : #111
Teks sekunder      : #999 / #bbb
Toggle ON          : #111
Toggle OFF         : #e0e0e0
Font               : Plus Jakarta Sans (400, 500, 600, 700)
```

---

### HEADER

```
background: white
border-bottom: 1px solid #ebebeb
height: 54px, padding: 0 24px
position: sticky, top 0, z-index 10

Isi:
- Tombol kembali: 30×30px, bg transparent, icon chevron kiri 18px stroke #111
  hover: bg #f5f5f5
- Judul "Order Online": 17px, font-weight 700, color #111, letter-spacing -0.3px
```

---

### KONTEN

max-width: 680px, margin: 0 auto, padding: 20px 16px

**Card setting** (white, border-radius 12px, border `1px solid #ebebeb`, margin-bottom 12px):

Row tunggal, padding 16px:
```
- Icon container: 36×36px, border-radius 8px, bg #f5f5f5
  Icon: shopping bag SVG 17px, stroke #555, fill none, stroke-width 1.8
- Label: "Terima pesanan online", 14px, font-weight 600, color #111
- Status (di bawah label): "Aktif" / "Nonaktif"
    Aktif   : 12px, font-weight 500, color #111
    Nonaktif: 12px, font-weight 500, color #bbb
- Toggle (kanan): lihat spesifikasi toggle di bawah
```

**Teks keterangan** (di bawah card):
```
font-size: 12px, color: #aaa, line-height: 1.6, padding: 0 4px
Teks: "Bila aktif, pelanggan bisa memesan sendiri lewat QR di meja.
       Matikan saat outlet tutup atau dapur penuh."
```

---

### KOMPONEN TOGGLE

```
Track  : 44×26px, border-radius 13px
         OFF → background #e0e0e0
         ON  → background #111
         transition: background 0.2s

Thumb  : 20×20px, border-radius 50%, background white
         box-shadow: 0 1px 3px rgba(0,0,0,0.2)
         OFF → left 3px
         ON  → left 21px
         transition: left 0.2s
```

---

### STATE

```typescript
const [orderOnline, setOrderOnline] = useState(true);
// Toggle → setOrderOnline(prev => !prev)
// Tidak ada tombol Simpan — perubahan langsung tersimpan (atau kirim ke API on toggle)
```
