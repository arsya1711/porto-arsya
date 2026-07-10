# Prompt Claude Code — Notifikasi Suara (Sub-halaman Pengaturan)

---

## PROMPT

Implementasikan sub-halaman **Notifikasi Suara** dalam menu Pengaturan aplikasi POS restoran.

---

### HEADER

```
← Notifikasi Suara   (tidak ada tombol Simpan)
```

---

### KONTEN

max-width: 680px, margin: 0 auto, padding: 20px 16px

**Card setting** (white, border-radius 12px, border `1px solid #ebebeb`, margin-bottom 12px):

Row tunggal, padding 16px:
```
- Icon container: 36×36px, border-radius 8px, bg #f5f5f5
  Icon: lonceng (bell) SVG 17px, stroke #555, fill none, stroke-width 1.8
- Label: "Suara notifikasi pesanan", 14px, font-weight 600, color #111
- Status:
    Aktif    → 12px, font-weight 500, color #111
    Nonaktif → 12px, font-weight 500, color #bbb
- Toggle (kanan)
```

**Teks keterangan** (di bawah card):
```
font-size: 12px, color: #aaa, line-height: 1.6, padding: 0 4px
Teks: "Bunyikan suara & getar saat ada pesanan baru masuk.
       Pengaturan ini berlaku untuk perangkat ini saja."
```

---

### KOMPONEN TOGGLE

```
Track : 44×26px, border-radius 13px, OFF #e0e0e0 / ON #111, transition 0.2s
Thumb : 20×20px, border-radius 50%, bg white, shadow 0 1px 3px rgba(0,0,0,0.2)
        OFF left 3px / ON left 21px, transition 0.2s
```

---

### STATE

```typescript
const [notifikasi, setNotifikasi] = useState(true);
// Toggle langsung tersimpan ke device (localStorage atau platform notification API)
```
