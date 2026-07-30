import assert from "node:assert/strict";
import test from "node:test";

import { normalizeMinimumAppVersion } from "../src/lib/app-version";

test("versi minimum menerima semver numerik dan menolak nilai ambigu", () => {
  assert.equal(normalizeMinimumAppVersion(" 1.0.4 "), "1.0.4");
  assert.equal(normalizeMinimumAppVersion("1.2"), "1.2");
  assert.equal(normalizeMinimumAppVersion(""), null);
  assert.equal(normalizeMinimumAppVersion("v1.0.4"), undefined);
  assert.equal(normalizeMinimumAppVersion("1.0.4-beta"), undefined);
});
