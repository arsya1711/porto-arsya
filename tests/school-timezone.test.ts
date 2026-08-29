import assert from "node:assert/strict";
import test from "node:test";

import {
  addMinutesToSchoolDateTimeInput,
  isoToSchoolDateTimeInput,
  schoolDateTimeRangeMinutes,
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
    ),
    "2026-07-24T09:30",
  );
  assert.equal(schoolDateTimeToIso("tanggal-rusak", "Asia/Jakarta"), null);
});

test("rentang jadwal menghitung batas selesai ujian dalam menit", () => {
  assert.equal(
    addMinutesToSchoolDateTimeInput(
      "2026-07-24T09:30",
      90,
      "Asia/Jakarta",
    ),
    "2026-07-24T11:00",
  );
  assert.equal(
    schoolDateTimeRangeMinutes(
      "2026-07-24T09:30",
      "2026-07-24T11:00",
      "Asia/Jakarta",
    ),
    90,
  );
  assert.equal(
    schoolDateTimeRangeMinutes(
      "2026-07-24T11:00",
      "2026-07-24T09:30",
      "Asia/Jakarta",
    ),
    -90,
  );
  assert.equal(
    schoolDateTimeRangeMinutes("tanggal-rusak", "2026-07-24T11:00"),
    null,
  );
});
