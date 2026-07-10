# Prompt Claude Code — Struk & Biaya (Sub-halaman Pengaturan)

---

## PROMPT

Implementasikan sub-halaman **Struk & Biaya** dalam menu Pengaturan aplikasi POS restoran.

---

### HEADER

```
← Struk & Biaya                          [Simpan]

Tombol Simpan: padding 7px 16px, border-radius 8px, bg #111, text white, 13px 600
hover: bg #333
```

---

### SECTION 1: TAMPILAN STRUK

Label section: `11px, font-weight 700, color #999, uppercase, letter-spacing 0.8px, margin-bottom 8px`

Card (white, border-radius 12px, border `1px solid #ebebeb`, overflow hidden):

Rows toggle (border-bottom `1px solid #f0f0f0` antar row):

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

Setiap row:
```
display: flex, align-items: center, padding: 14px 16px
Label: flex 1, 14px, font-weight 500, color #111
Toggle: [lihat spesifikasi toggle]
```

**Textarea footer struk** (dalam card, setelah semua toggle, padding 14px 16px):
```
placeholder: "Catatan kaki struk (footer)"
rows: 2
width: 100%
padding: 10px 12px
background: #f8f8f8
border: 1.5px solid #ebebeb
border-radius: 8px
font-size: 13px, color #111
line-height: 1.5
resize: vertical
```

---

### SECTION 2: PAJAK & SERVICE CHARGE

Label section: sama style

Card terpisah (white, border-radius 12px, border `1px solid #ebebeb`, overflow hidden):

**Row: Pajak Aktif** — toggle (default ON), border-bottom
**Row: Harga Sudah Termasuk Pajak** — toggle (default OFF), border-bottom

**Grid 2 kolom** (border-bottom `1px solid #f0f0f0`):
- Kiri (border-right `1px solid #f0f0f0`): Field "NAMA PAJAK", value "PPN"
- Kanan: Field "PAJAK (%)", value "10"

**Row: SERVICE CHARGE (%)**, value "2"

**Style field:**
```
padding: 14px 16px
Label: font-size 11px, font-weight 600, color #999, letter-spacing 0.4px, uppercase, margin-bottom 6px
Input: border none, background transparent, font-size 14px, font-weight 600, color #111, width 100%
input:focus { outline: none }
```

---

### KOMPONEN TOGGLE

```
Track  : 44×26px, border-radius 13px
         OFF → #e0e0e0 | ON → #111 | transition 0.2s
Thumb  : 20×20px, border-radius 50%, bg white
         box-shadow: 0 1px 3px rgba(0,0,0,0.2)
         OFF → left 3px | ON → left 21px | transition 0.2s
```

---

### STATE

```typescript
interface StrukBiayaState {
  tampilLogo: boolean;        // true
  namaOutlet: boolean;        // true
  alamat: boolean;            // true
  telepon: boolean;           // true
  noNota: boolean;            // true
  waktu: boolean;             // false
  kasir: boolean;             // true
  customer: boolean;          // true
  nomorMeja: boolean;         // true
  pajakAktif: boolean;        // true
  hargaIncludePajak: boolean; // false
  namaPajak: string;          // "PPN"
  persenPajak: number;        // 10
  serviceCharge: number;      // 2
  catatanFooter: string;      // ""
}
```
