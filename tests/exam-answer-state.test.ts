import assert from "node:assert/strict";
import test from "node:test";

import {
  isAnsweredValue,
  mayFinalizeAttempt,
  normalizeStoredAnswers,
  normalizeStoredMarks,
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

test("normalisasi penanda lokal menolak data rusak dan duplikat", () => {
  assert.deepEqual(
    normalizeStoredMarks(["question-1", null, "", 2, "question-1", "question-2"]),
    ["question-1", "question-2"],
  );
  assert.deepEqual(normalizeStoredMarks({ question: "question-1" }), []);
  assert.deepEqual(normalizeStoredMarks("question-1"), []);
});

test("attempt kedaluwarsa tetap difinalisasi walau sinkronisasi terlambat", () => {
  assert.equal(mayFinalizeAttempt(1, false), false);
  assert.equal(mayFinalizeAttempt(1, true), true);
  assert.equal(mayFinalizeAttempt(0, false), true);
});
