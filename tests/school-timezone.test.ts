import assert from "node:assert/strict";
import test from "node:test";

import {
  isoToSchoolDateTimeInput,
  schoolDateTimeToIso,
} from "../src/lib/school-timezone";

test("jadwal sekolah dikonversi menggunakan zona waktu yang dipilih", () => {
  assert.equal(
    schoolDateTimeToIso("2026-07-24T09:30", "Asia/Jakarta"),
    "2026-07-24T02:30:00.000Z",
  );
  assert.equal(
    schoolDateTimeToIso("2026-07-24T09:30", "Asia/Makassar"),
    "2026-07-24T01:30:00.000Z",
  );
});

test("waktu UTC ditampilkan kembali sebagai waktu sekolah", () => {
  assert.equal(
    isoToSchoolDateTimeInput(
      "2026-07-24T02:30:00.000Z",
      "Asia/Jakarta",
    ),
    "2026-07-24T09:30",
  );
  assert.equal(schoolDateTimeToIso("tanggal-rusak", "Asia/Jakarta"), null);
});
