import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

function parseEnv(source) {
  return Object.fromEntries(
    source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        const key = line.slice(0, separator).trim();
        let value = line.slice(separator + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"'))
          || (value.startsWith("'") && value.endsWith("'"))
        ) value = value.slice(1, -1);
        return [key, value];
      }),
  );
}

const fileEnv = parseEnv(await readFile(process.env.ENV_FILE ?? ".env", "utf8"));
const supabaseUrl = fileEnv.VITE_SUPABASE_URL;
const anonKey = fileEnv.VITE_SUPABASE_ANON_KEY;
const appOrigin = new URL(process.env.APP_URL ?? "https://porto-arsya.pages.dev").origin;
assert.ok(supabaseUrl && anonKey, "Konfigurasi Supabase tidak lengkap");

const required = [
  "TEST_ADMIN_EMAIL",
  "TEST_ADMIN_PASSWORD",
  "TEST_GURU_EMAIL",
  "TEST_GURU_PASSWORD",
  "TEST_STUDENT_NIS",
  "TEST_STUDENT_PASSWORD",
];
const missing = required.filter((name) => !process.env[name]);
assert.equal(
  missing.length,
  0,
  `Credential akun uji belum lengkap: ${missing.join(", ")}`,
);

const commonHeaders = { apikey: anonKey, "Content-Type": "application/json" };

async function verifyAccessToken(accessToken, expectedRole) {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/profiles?select=id,role,active&id=eq.${JSON.parse(
      Buffer.from(accessToken.split(".")[1], "base64url").toString("utf8"),
    ).sub}`,
    {
      headers: {
        ...commonHeaders,
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
  assert.equal(response.status, 200, `Profil ${expectedRole} tidak dapat dibaca`);
  const rows = await response.json();
  assert.equal(rows.length, 1, `Profil ${expectedRole} tidak ditemukan`);
  assert.equal(rows[0].role, expectedRole, `Role akun bukan ${expectedRole}`);
  assert.equal(rows[0].active, true, `Akun ${expectedRole} tidak aktif`);
}

async function staffLogin(role, email, password) {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: commonHeaders,
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 200, `Login ${role} gagal (HTTP ${response.status})`);
  const session = await response.json();
  assert.ok(session.access_token, `Token ${role} tidak tersedia`);
  await verifyAccessToken(session.access_token, role);
  console.log(`  ✓ Login ${role}`);
}

await staffLogin("admin", process.env.TEST_ADMIN_EMAIL, process.env.TEST_ADMIN_PASSWORD);
await staffLogin("guru", process.env.TEST_GURU_EMAIL, process.env.TEST_GURU_PASSWORD);

const studentResponse = await fetch(`${supabaseUrl}/functions/v1/student-login`, {
  method: "POST",
  headers: {
    ...commonHeaders,
    Authorization: `Bearer ${anonKey}`,
    Origin: appOrigin,
  },
  body: JSON.stringify({
    student_number: process.env.TEST_STUDENT_NIS,
    password: process.env.TEST_STUDENT_PASSWORD,
  }),
});
assert.equal(studentResponse.status, 200, `Login siswa gagal (HTTP ${studentResponse.status})`);
const studentSession = await studentResponse.json();
assert.ok(studentSession.session?.access_token, "Token siswa tidak tersedia");
await verifyAccessToken(studentSession.session.access_token, "siswa");
console.log("  ✓ Login siswa melalui NIS");
console.log("✓ Smoke test tiga role lulus; tidak ada data akademik yang diubah");
