import assert from "node:assert/strict";
import test from "node:test";

import {
  formatExamRemaining,
  parseExamDeadline,
  remainingSecondsFromDeadline,
} from "../src/lib/exam-timer";

test("timer menghitung ulang sisa waktu berdasarkan deadline absolut", () => {
  assert.equal(remainingSecondsFromDeadline(91_001, 1_000), 91);
  assert.equal(remainingSecondsFromDeadline(1_000, 1_000), 0);
  assert.equal(remainingSecondsFromDeadline(999, 1_000), 0);
});

test("timer memformat durasi dan menolak deadline rusak", () => {
  assert.equal(formatExamRemaining(5_461), "01:31:01");
  assert.equal(formatExamRemaining(Number.NaN), "00:00:00");
  assert.equal(parseExamDeadline("2026-07-23T10:00:00.000Z"), 1_784_800_800_000);
  assert.equal(parseExamDeadline("deadline-rusak"), null);
});
