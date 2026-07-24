import assert from "node:assert/strict";
import test from "node:test";

import { deriveExamStatus } from "../src/lib/exam-status";

const start = "2026-07-24T02:00:00.000Z";
const end = "2026-07-24T03:00:00.000Z";

test("status draft tidak berubah berdasarkan waktu", () => {
  assert.equal(
    deriveExamStatus("draft", start, end, 60, Date.parse(end) + 1),
    "draft",
  );
});

test("status ujian dihitung konsisten dari jadwal absolut", () => {
  assert.equal(
    deriveExamStatus("terjadwal", start, end, 60, Date.parse(start) - 1),
    "terjadwal",
  );
  assert.equal(
    deriveExamStatus("terjadwal", start, end, 60, Date.parse(start)),
    "berlangsung",
  );
  assert.equal(
    deriveExamStatus("terjadwal", start, end, 60, Date.parse(end) + 1),
    "selesai",
  );
});

test("durasi dipakai ketika waktu selesai tidak tersedia", () => {
  assert.equal(
    deriveExamStatus(
      "terjadwal",
      start,
      null,
      30,
      Date.parse(start) + 29 * 60_000,
    ),
    "berlangsung",
  );
  assert.equal(
    deriveExamStatus(
      "terjadwal",
      start,
      null,
      30,
      Date.parse(start) + 31 * 60_000,
    ),
    "selesai",
  );
});
