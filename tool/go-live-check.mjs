import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appUrl = new URL(process.env.APP_URL ?? "https://porto-arsya.pages.dev");
const envFile = process.env.ENV_FILE ?? ".env";
const timeoutMs = Number(process.env.CHECK_TIMEOUT_MS ?? 15_000);

function parseEnv(source) {
  const result = {};
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[match[1]] = value;
  }
  return result;
}

async function checkedFetch(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      redirect: "follow",
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function assertSecurityHeaders(response) {
  assert.equal(
    response.headers.get("x-content-type-options"),
    "nosniff",
    "Header nosniff tidak tersedia",
  );
  assert.equal(
    response.headers.get("x-frame-options"),
    "DENY",
    "Halaman masih dapat dimuat dalam frame",
  );
  assert.match(
    response.headers.get("content-security-policy") ?? "",
    /default-src\s+'self'/,
    "Content-Security-Policy tidak tersedia",
  );
}

const env = parseEnv(await readFile(envFile, "utf8"));
const supabaseUrl = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;
assert.ok(/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(supabaseUrl ?? ""), "VITE_SUPABASE_URL tidak valid");
assert.ok(anonKey && !/your-|placeholder/i.test(anonKey), "VITE_SUPABASE_ANON_KEY belum valid");

console.log(`• Memeriksa aplikasi: ${appUrl.origin}`);
const entryPaths = ["/", "/app/bank-soal"];
let productionBundles = "";

for (const path of entryPaths) {
  const url = new URL(path, appUrl);
  const response = await checkedFetch(url);
  assert.equal(response.status, 200, `${path} menghasilkan HTTP ${response.status}`);
  assert.match(response.headers.get("content-type") ?? "", /text\/html/i);
  assertSecurityHeaders(response);
  const html = await response.text();
  assert.match(html, /<title>AWExam<\/title>/);
  assert.match(html, /id=["']root["']/);

  if (path === "/") {
    const assets = [
      ...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/gi),
    ].map((match) => new URL(match[1], appUrl));
    assert.ok(assets.length > 0, "Asset JavaScript/CSS production tidak ditemukan");
    for (const assetUrl of assets) {
      const assetResponse = await checkedFetch(assetUrl);
      assert.equal(assetResponse.status, 200, `Asset ${assetUrl.pathname} gagal dimuat`);
      const content = await assetResponse.text();
      assert.ok(content.length > 100, `Asset ${assetUrl.pathname} kosong`);
      productionBundles += content;
    }
  }
  console.log(`  ✓ ${path} dapat dibuka`);
}

const projectHost = new URL(supabaseUrl).hostname;
assert.ok(
  productionBundles.includes(supabaseUrl.replace(/\/$/, ""))
    || productionBundles.includes(projectHost),
  "Build production tidak menunjuk ke project Supabase pada file environment ini",
);
console.log("  ✓ Build production memakai project Supabase yang diharapkan");

const apiHeaders = {
  apikey: anonKey,
  Authorization: `Bearer ${anonKey}`,
};
const authHealth = await checkedFetch(new URL("/auth/v1/health", supabaseUrl), {
  headers: apiHeaders,
});
assert.equal(authHealth.status, 200, `Supabase Auth health menghasilkan HTTP ${authHealth.status}`);

const restHealth = await checkedFetch(
  new URL("/rest/v1/school_profile_settings?select=id&limit=1", supabaseUrl),
  { headers: apiHeaders },
);
assert.equal(restHealth.status, 200, `Supabase REST menghasilkan HTTP ${restHealth.status}`);
console.log("  ✓ Supabase Auth dan REST dapat dijangkau");

for (const functionName of ["admin-users", "student-login", "import-questions"]) {
  const response = await checkedFetch(
    new URL(`/functions/v1/${functionName}`, supabaseUrl),
    {
      method: "OPTIONS",
      headers: { ...apiHeaders, Origin: appUrl.origin },
    },
  );
  assert.ok(response.ok, `${functionName} preflight menghasilkan HTTP ${response.status}`);
  assert.equal(
    response.headers.get("access-control-allow-origin"),
    appUrl.origin,
    `${functionName} belum mengizinkan origin ${appUrl.origin}`,
  );
  console.log(`  ✓ Edge Function ${functionName} menerima origin production`);
}

console.log("✓ Pemeriksaan go-live infrastruktur lulus");
