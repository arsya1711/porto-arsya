import assert from "node:assert/strict";
import test from "node:test";

import {
  isValidExamDuration,
  parseExamDurationInput,
} from "../src/lib/exam-duration";

test("input durasi boleh dikosongkan selama pengguna sedang mengetik", () => {
  assert.equal(parseExamDurationInput(""), "");
  assert.equal(parseExamDurationInput("90"), 90);
});

test("durasi ujian wajib berupa menit bulat dalam rentang yang didukung", () => {
  assert.equal(isValidExamDuration(""), false);
  assert.equal(isValidExamDuration(0), false);
  assert.equal(isValidExamDuration(1), true);
  assert.equal(isValidExamDuration(90), true);
  assert.equal(isValidExamDuration(90.5), false);
  assert.equal(isValidExamDuration(481), false);
});

