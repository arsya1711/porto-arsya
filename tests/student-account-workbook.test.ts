import assert from "node:assert/strict";
import test from "node:test";

import JSZip from "jszip";

import { buildStudentAccountWorkbook } from "../src/lib/student-account-workbook";

test("workbook akun siswa berisi layout, filter, dan data yang aman", async () => {
  const blob = await buildStudentAccountWorkbook({
    schoolName: "MTs Uji & Coba",
    className: "VIII A",
    exportedAt: new Date("2026-08-03T02:00:00.000Z"),
    rows: [
      {
        number: 1,
        name: "Ayu <Putri>",
        email: "ayu@example.com",
        temporaryPassword: "Sementara123",
        className: "VIII A",
        studentNumber: "001234",
        status: "Aktif",
      },
    ],
  });
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  assert.ok(zip.file("xl/workbook.xml"));
  assert.ok(zip.file("xl/styles.xml"));
  const sheet = await zip.file("xl/worksheets/sheet1.xml")?.async("string");
  assert.ok(sheet);
  assert.match(sheet, /state="frozen"/);
  assert.match(sheet, /autoFilter ref="A5:G6"/);
  assert.match(sheet, /mergeCell ref="A1:G1"/);
  assert.match(sheet, /Ayu &lt;Putri&gt;/);
  assert.match(sheet, /001234/);
});

