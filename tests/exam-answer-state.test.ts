import assert from "node:assert/strict";
import test from "node:test";

import {
  isAnsweredValue,
  normalizeStoredAnswers,
} from "../src/lib/exam-answer-state";

test("normalisasi jawaban lokal membuang nilai yang dapat merusak render", () => {
  assert.deepEqual(
    normalizeStoredAnswers({
      pilihan: 0,
      essay: " jawaban ",
      kosong: null,
      rusak: { value: 1 },
      takTerdefinisi: undefined,
      bukanAngka: Number.NaN,
    }),
    { pilihan: 0, essay: " jawaban " },
  );
});

test("penghitung jawaban hanya menerima angka valid atau teks berisi", () => {
  assert.equal(isAnsweredValue(0), true);
  assert.equal(isAnsweredValue(" jawaban "), true);
  assert.equal(isAnsweredValue("   "), false);
  assert.equal(isAnsweredValue(null), false);
  assert.equal(isAnsweredValue(Number.NaN), false);
});
