import assert from "node:assert/strict";
import test from "node:test";
import { parsePdfQuestions } from "../src/lib/pdf-question-parser";
import { parseGiftQuestions } from "../src/lib/question-import-formats";
import { questionSimilarity } from "../src/lib/question-similarity";

test("parser PDF membaca soal pilihan ganda dan essay", () => {
  const result = parsePdfQuestions(`
SOAL 1
TIPE: PG
PERTANYAAN: Hasil dari 2 + 3 adalah ...
A. 4
B. 5
C. 6
D. 7
KUNCI: B
KESULITAN: Mudah
BOBOT: 1

SOAL 2
TIPE: ESSAY
PERTANYAAN: Jelaskan proses fotosintesis.
JAWABAN: Tumbuhan menggunakan cahaya untuk membentuk glukosa.
KESULITAN: Sedang
BOBOT: 2
`);

  assert.deepEqual(result.errors, []);
  assert.equal(result.questions.length, 2);
  assert.deepEqual(result.questions[0], {
    sourceNumber: 1,
    type: "Pilihan Ganda",
    text: "Hasil dari 2 + 3 adalah ...",
    difficulty: "Mudah",
    options: ["4", "5", "6", "7"],
    correctOption: 1,
    answerKey: "",
    weight: 1,
    errors: [],
  });
  assert.equal(result.questions[1].type, "Essay");
  assert.equal(result.questions[1].weight, 2);
  assert.match(result.questions[1].answerKey, /membentuk glukosa/);
  assert.deepEqual(result.questions[1].errors, []);
});

test("parser PDF menolak kunci dan metadata yang tidak valid", () => {
  const result = parsePdfQuestions(`
SOAL 1
TIPE: PILIHAN GANDA
PERTANYAAN: Pilih jawaban yang benar.
A. Pertama
C. Ketiga
KUNCI: D
KESULITAN: Sangat Sulit
BOBOT: 0
`);

  const errors = result.questions[0].errors.join(" ");
  assert.match(errors, /Urutan opsi/);
  assert.match(errors, /Kunci pilihan ganda/);
  assert.match(errors, /Kesulitan/);
  assert.match(errors, /Bobot/);
});

test("parser PDF mendeteksi duplikat dan PDF tanpa penanda soal", () => {
  const duplicate = parsePdfQuestions(`
SOAL 1: Apa ibu kota Indonesia?
TIPE: ESSAY
JAWABAN: Jakarta

SOAL 2: Apa ibu kota Indonesia?
TIPE: ESSAY
JAWABAN: Jakarta
`);
  assert.match(duplicate.questions[1].errors.join(" "), /sama dengan soal 1/);

  const missingHeader = parsePdfQuestions("Pertanyaan tanpa penanda nomor.");
  assert.equal(missingHeader.questions.length, 0);
  assert.match(missingHeader.errors[0], /SOAL 1/);
});

test("parser GIFT membaca pilihan ganda dan jawaban singkat", () => {
  const result = parseGiftQuestions(`
::Penjumlahan::Hasil 2 + 3 adalah {~4 =5 ~6 ~7}

Ibu kota Indonesia adalah {=Jakarta}
`);
  assert.equal(result.questions.length, 2);
  assert.equal(result.questions[0].type, "Pilihan Ganda");
  assert.equal(result.questions[0].correctOption, 1);
  assert.equal(result.questions[1].type, "Essay");
  assert.equal(result.questions[1].answerKey, "Jakarta");
});

test("deteksi kemiripan mengenali soal dengan perubahan kecil", () => {
  const score = questionSimilarity(
    "Jelaskan proses fotosintesis pada tumbuhan hijau.",
    "Jelaskanlah proses fotosintesis pada tumbuhan hijau!",
  );
  assert.ok(score >= 0.88);
  assert.ok(questionSimilarity("Berapakah 2 + 2?", "Sebutkan ibu kota Indonesia") < 0.5);
});
