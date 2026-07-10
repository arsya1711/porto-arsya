# Prompt Claude Code — Info Outlet (Sub-halaman Pengaturan)

---

## PROMPT

Implementasikan sub-halaman **Info Outlet** dalam menu Pengaturan aplikasi POS restoran.

---

### HEADER

```
← Info Outlet                            [Simpan]
```

---

### KONTEN

max-width: 680px, margin: 0 auto, padding: 20px 16px

**Card form** (white, border-radius 12px, border `1px solid #ebebeb`, overflow hidden):

Fields (stacked, border-bottom `1px solid #f0f0f0` antar field, kecuali terakhir):

| Field | Type | Placeholder / Value |
|---|---|---|
| NAMA OUTLET | text | "Time 420s" (nilai awal) |
| ALAMAT | text | "Masukkan alamat" |
| TELEPON | tel | "Masukkan nomor telepon" |
| KOTA | text | "Masukkan kota" |

**Style setiap field:**
```
padding: 14px 16px

Label:
  font-size: 11px
  font-weight: 600
  color: #999
  text-transform: uppercase
  letter-spacing: 0.4px
  margin-bottom: 6px

Input:
  width: 100%
  border: none
  background: transparent
  font-family: inherit
  font-size: 14px
  font-weight: 600 (jika ada nilai) / 400 (placeholder)
  color: #111
  padding: 0

input:focus { outline: none }
input::placeholder { color: #bbb }
```

---

### STATE

```typescript
interface InfoOutletState {
  namaOutlet: string;  // "Time 420s"
  alamat: string;      // ""
  telepon: string;     // ""
  kota: string;        // ""
}
```

---

### BEHAVIOUR

- Tombol **Simpan** → validasi nama outlet tidak kosong → kirim ke API → tampilkan feedback sukses/error
- Semua field wajib diisi kecuali KOTA (opsional)
