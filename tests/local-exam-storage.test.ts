import assert from "node:assert/strict";
import test from "node:test";

import { clearLocalExamData } from "../src/lib/local-exam-storage";

test("logout hanya membersihkan draft jawaban dan penanda ujian", () => {
  const values = new Map<string, string>([
    ["ruang-ujian:answers:exam-1", '{"question-1":1}'],
    ["ruang-ujian:marked:exam-1", '["question-1"]'],
    ["awexam:last-error", '{"referenceId":"safe"}'],
    ["tema", "gelap"],
  ]);
  const storage = {
    get length() {
      return values.size;
    },
    key(index: number) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
  };

  clearLocalExamData(storage);

  assert.deepEqual([...values.keys()].sort(), ["awexam:last-error", "tema"]);
});

test("pembersihan draft tetap aman ketika storage browser menolak akses", () => {
  const deniedStorage = {
    get length(): number {
      throw new Error("storage denied");
    },
    key() {
      return null;
    },
    removeItem() {},
  };

  assert.doesNotThrow(() => clearLocalExamData(deniedStorage));
});
