# Prompt Claude Code — Promo (Sub-halaman Pengaturan)

---

## PROMPT

Implementasikan sub-halaman **Promo** dalam menu Pengaturan aplikasi POS restoran.

---

### HEADER

```
← Promo   (tidak ada tombol Simpan)
```

---

### KONTEN

max-width: 680px, margin: 0 auto, padding: 20px 16px 100px (beri ruang untuk FAB)

**Card list promo** (white, border-radius 12px, border `1px solid #ebebeb`, overflow hidden):

Setiap row promo:
```
display: flex, align-items: center, padding: 14px 16px
border-bottom: 1px solid #f0f0f0(kecuali terakhir)
cursor: pointer
hover: background #fafafa, transition 0.1s

- Icon container: 36×36px, border-radius 8px, bg #f5f5f5
  Icon: tag SVG 17px, stroke #555, fill none, stroke-width 1.8
  margin-right: 14px
- Nama promo: 14px, font-weight 600, color #111
- Sub-label: tipe · nilai, 12px, color #999, margin-top 1px
- Chevron: SVG 14px, stroke #ccc
```

Data contoh:
| Nama | Tipe | Nilai |
|---|---|---|
| Diskon Pembukaan | Persentase | 10% |

---

### FAB (Floating Action Button)

```
position: fixed, bottom: 24px, right: 24px
display: flex, align-items: center, gap: 8px
padding: 14px 20px
background: #111, color: white
border: none, border-radius: 50px
font-family: inherit, font-size: 14px, font-weight: 600
cursor: pointer
box-shadow: 0 4px 16px rgba(0,0,0,0.2)
hover: background #333

Label: "+ Tambah Promo" (icon plus SVG 16px di kiri)
```

---

### BEHAVIOUR

- Tap baris promo → navigasi ke halaman detail/edit promo
- Tap FAB → buka form tambah promo baru

---

### STATE

```typescript
interface Promo {
  id: string;
  nama: string;
  tipe: 'persentase' | 'nominal';
  nilai: number;
}

const [promos, setPromos] = useState<Promo[]>([
  { id: '1', nama: 'Diskon Pembukaan', tipe: 'persentase', nilai: 10 }
]);
```
