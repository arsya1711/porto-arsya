# Prompt Claude Code — Pembayaran Non-Tunai (Sub-halaman Pengaturan)

---

## PROMPT

Implementasikan sub-halaman **Pembayaran Non-Tunai** dalam menu Pengaturan aplikasi POS restoran.

---

### HEADER

```
← Pembayaran Non-Tunai                   [Simpan]
```

---

### KONTEN

max-width: 680px, margin: 0 auto, padding: 20px 16px

**Card tunggal** (white, border-radius 12px, border `1px solid #ebebeb`, overflow hidden):

Rows (border-bottom `1px solid #f0f0f0` antar row):

| Label | Kontrol | Default |
|---|---|---|
| Tunai | Teks "Selalu aktif" (bukan toggle) | — |
| QRIS | Toggle | ON |
| Kartu Debit | Toggle | ON |
| Kartu Kredit | Toggle | OFF |
| E-Wallet | Toggle | ON |
| Transfer Bank | Toggle | ON |

**Row Tunai** (khusus):
```
display: flex, align-items: center, padding: 14px 16px
Label: flex 1, 14px, font-weight 500, color #111
Keterangan: "Selalu aktif", 12px, color #bbb, font-weight 500
```

**Row Toggle:**
```
display: flex, align-items: center, padding: 14px 16px
Label: flex 1, 14px, font-weight 500, color #111
Toggle: [lihat spesifikasi]
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
interface PembayaranState {
  qris: boolean;         // true
  kartuDebit: boolean;   // true
  kartuKredit: boolean;  // false
  eWallet: boolean;      // true
  transferBank: boolean; // true
}
// Tunai selalu aktif, tidak bisa diubah
```
