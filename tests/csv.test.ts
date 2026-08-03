import assert from "node:assert/strict";
import test from "node:test";

import { encodeCsv, escapeCsvCell } from "../src/lib/csv";

test("CSV menetralkan formula spreadsheet dari data pengguna", () => {
  assert.equal(escapeCsvCell("=1+1"), "\"'=1+1\"");
  assert.equal(escapeCsvCell("  @SUM(A1:A2)"), "\"'  @SUM(A1:A2)\"");
  assert.equal(escapeCsvCell("-2+3"), "\"'-2+3\"");
  assert.equal(escapeCsvCell("+cmd"), "\"'+cmd\"");
});

test("CSV tetap meng-escape kutip dan mempertahankan nilai biasa", () => {
  assert.equal(escapeCsvCell('Nama "Siswa"'), '"Nama ""Siswa"""');
  assert.equal(
    encodeCsv([
      ["Nama", "Nilai"],
      ["Ayu", 90],
    ]),
    '"Nama","Nilai"\n"Ayu","90"',
  );
});

test("CSV mendukung pemisah dan baris baru yang dikenali Excel", () => {
  assert.equal(
    encodeCsv(
      [
        ["Nama", "Kelas"],
        ["Ayu", "VIII A"],
      ],
      ";",
      "\r\n",
    ),
    '"Nama";"Kelas"\r\n"Ayu";"VIII A"',
  );
});
