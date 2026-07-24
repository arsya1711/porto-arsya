import assert from "node:assert/strict";

const appUrl = new URL(process.env.APP_URL ?? "https://porto-arsya.pages.dev");
const total = Number(process.env.LOAD_REQUESTS ?? 60);
const concurrency = Number(process.env.LOAD_CONCURRENCY ?? 6);
const timeoutMs = Number(process.env.LOAD_TIMEOUT_MS ?? 10_000);
const paths = ["/", "/app/bank-soal", "/app/ujian"];

assert.ok(Number.isInteger(total) && total >= 1 && total <= 1_000, "LOAD_REQUESTS harus 1-1000");
assert.ok(Number.isInteger(concurrency) && concurrency >= 1 && concurrency <= 25, "LOAD_CONCURRENCY harus 1-25");

let cursor = 0;
const durations = [];
const failures = [];

async function worker() {
  while (true) {
    const index = cursor++;
    if (index >= total) return;
    const path = paths[index % paths.length];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = performance.now();
    try {
      const response = await fetch(new URL(path, appUrl), {
        redirect: "follow",
        cache: "no-store",
        signal: controller.signal,
      });
      const body = await response.text();
      const duration = performance.now() - startedAt;
      durations.push(duration);
      if (!response.ok || !/<title>AWExam<\/title>/.test(body)) {
        failures.push(`${path}: HTTP ${response.status}`);
      }
    } catch (error) {
      failures.push(`${path}: ${error instanceof Error ? error.message : "request gagal"}`);
    } finally {
      clearTimeout(timer);
    }
  }
}

console.log(`• Simulasi aman ${total} request ke ${appUrl.origin} (konkurensi ${concurrency})`);
await Promise.all(Array.from({ length: concurrency }, () => worker()));

durations.sort((a, b) => a - b);
const percentile = (value) => durations[Math.min(
  durations.length - 1,
  Math.max(0, Math.ceil((value / 100) * durations.length) - 1),
)] ?? Infinity;
const successRate = ((total - failures.length) / total) * 100;

console.log(`  Keberhasilan: ${successRate.toFixed(1)}%`);
console.log(`  Latensi p50: ${Math.round(percentile(50))} ms`);
console.log(`  Latensi p95: ${Math.round(percentile(95))} ms`);
console.log(`  Latensi p99: ${Math.round(percentile(99))} ms`);
if (failures.length) console.log(`  Kegagalan pertama: ${failures[0]}`);

assert.ok(successRate >= 99, "Tingkat keberhasilan di bawah 99%");
assert.ok(percentile(95) <= 5_000, "Latensi p95 melebihi 5 detik");
console.log("✓ Simulasi beban statis aman lulus");
