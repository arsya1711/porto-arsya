const examDraftPrefixes = [
  "ruang-ujian:answers:",
  "ruang-ujian:marked:",
];

/// Mencegah jawaban siswa sebelumnya terbaca oleh pengguna berikutnya pada
/// browser/perangkat bersama. Kunci aplikasi lain tidak ikut dihapus.
export function clearLocalExamData(
  storage: Pick<Storage, "key" | "length" | "removeItem"> = localStorage,
) {
  try {
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (key && examDraftPrefixes.some((prefix) => key.startsWith(prefix))) {
        keys.push(key);
      }
    }
    for (const key of keys) storage.removeItem(key);
  } catch {
    // Storage dapat ditolak oleh browser; logout tetap harus dilanjutkan.
  }
}
