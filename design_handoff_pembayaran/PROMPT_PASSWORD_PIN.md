# Prompt Claude Code — Password & PIN (Sub-halaman Pengaturan)

---

## PROMPT

Implementasikan sub-halaman **Password & PIN** dalam menu Pengaturan aplikasi POS restoran.

---

### HEADER

```
← Password & PIN                         [Simpan]
```

---

### KONTEN

max-width: 680px, margin: 0 auto, padding: 20px 16px

**Card form** (white, border-radius 12px, border `1px solid #ebebeb`, overflow hidden):

Fields:

**Field 1 — PIN BARU:**
```
padding: 14px 16px
border-bottom: 1px solid #f0f0f0

Label: "PIN BARU (4 DIGIT)"
  font-size: 11px, font-weight: 600, color: #999
  text-transform: uppercase, letter-spacing: 0.4px, margin-bottom: 6px

Input:
  type: password
  maxlength: 4
  placeholder: "••••"
  font-size: 20px, letter-spacing: 8px, color: #111
  border: none, background: transparent, width: 100%, padding: 0
  inputmode: numeric (untuk mobile keyboard angka)
```

**Field 2 — KONFIRMASI PIN:**
```
padding: 14px 16px
(tanpa border-bottom)

Label: "KONFIRMASI PIN"
Input: sama style dengan field 1
```

**Teks keterangan** (di bawah card, padding 4px):
```
font-size: 12px, color: #aaa, line-height: 1.6
Teks: "PIN digunakan untuk membuka akses kasir. Pastikan Anda mengingatnya."
```

---

### VALIDASI

```typescript
// Saat tap Simpan:
1. PIN harus 4 digit angka
2. PIN baru === Konfirmasi PIN
3. Jika tidak cocok → tampilkan pesan error di bawah field konfirmasi
   style error: font-size 12px, color #dc2626, margin-top 6px

// Pesan error:
- PIN kurang dari 4 digit  → "PIN harus 4 digit"
- PIN tidak cocok          → "Konfirmasi PIN tidak sesuai"
```

---

### STATE

```typescript
interface PinState {
  pinBaru: string;        // ""
  konfirmasiPin: string;  // ""
  error: string | null;   // null
}
```
