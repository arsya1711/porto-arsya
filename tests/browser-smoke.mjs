import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const host = "127.0.0.1";
const previewPort = 4174;
const debugPort = 9334;
const baseUrl = `http://${host}:${previewPort}`;

function chromeExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  const executable = candidates.find((candidate) => existsSync(candidate));
  if (!executable) {
    throw new Error("Chrome/Chromium tidak ditemukan. Atur CHROME_PATH.");
  }
  return executable;
}

async function waitForUrl(url, options = {}) {
  const deadline = Date.now() + 20_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw lastError ?? new Error(`Timeout menunggu ${url}`);
}

class Cdp {
  #socket;
  #nextId = 1;
  #pending = new Map();
  #listeners = new Map();

  constructor(url) {
    this.#socket = new WebSocket(url);
    this.#socket.onmessage = (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id) {
        const pending = this.#pending.get(message.id);
        if (!pending) return;
        this.#pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }
      const listeners = this.#listeners.get(message.method) ?? [];
      this.#listeners.delete(message.method);
      for (const resolve of listeners) resolve(message.params);
    };
  }

  async open() {
    if (this.#socket.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      this.#socket.onopen = resolve;
      this.#socket.onerror = reject;
    });
  }

  send(method, params = {}) {
    const id = this.#nextId++;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#socket.send(JSON.stringify({ id, method, params }));
    });
  }

  event(method) {
    return new Promise((resolve) => {
      const listeners = this.#listeners.get(method) ?? [];
      listeners.push(resolve);
      this.#listeners.set(method, listeners);
    });
  }

  close() {
    this.#socket.close();
  }
}

const userDataDir = await mkdtemp(join(tmpdir(), "awexam-browser-"));
const preview = spawn(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["run", "preview", "--", "--host", host, "--port", String(previewPort)],
  { stdio: "ignore" },
);
let chrome;

try {
  await waitForUrl(baseUrl);
  chrome = spawn(
    chromeExecutable(),
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--no-sandbox",
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${userDataDir}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  const targetsResponse = await waitForUrl(
    `http://${host}:${debugPort}/json/list`,
  );
  const targets = await targetsResponse.json();
  const page = targets.find((target) => target.type === "page");
  assert.ok(page?.webSocketDebuggerUrl, "Target halaman Chrome tidak tersedia.");

  const cdp = new Cdp(page.webSocketDebuggerUrl);
  await cdp.open();
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 320,
    height: 800,
    deviceScaleFactor: 1,
    mobile: true,
  });

  let loaded = cdp.event("Page.loadEventFired");
  await cdp.send("Page.navigate", { url: baseUrl });
  await loaded;
  await new Promise((resolve) => setTimeout(resolve, 500));

  const mobileResult = await cdp.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const form = document.querySelector(".login-panel form");
      const button = document.querySelector(".login-button");
      const help = document.querySelector(".login-help");
      const rect = (element) => {
        const value = element?.getBoundingClientRect();
        return value ? { left: value.left, right: value.right, width: value.width } : null;
      };
      return {
        title: document.title,
        innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        form: rect(form),
        button: rect(button),
        helpScrollWidth: help?.scrollWidth ?? 0,
        helpClientWidth: help?.clientWidth ?? 0,
      };
    })()`,
  });
  const mobile = mobileResult.result.value;
  assert.equal(mobile.title, "AWExam");
  assert.equal(mobile.innerWidth, 320);
  assert.ok(mobile.scrollWidth <= 320, `Overflow halaman: ${mobile.scrollWidth}px`);
  assert.ok(mobile.form.left >= 0 && mobile.form.right <= 320);
  assert.ok(mobile.button.left >= 0 && mobile.button.right <= 320);
  assert.ok(mobile.helpScrollWidth <= mobile.helpClientWidth);

  loaded = cdp.event("Page.loadEventFired");
  await cdp.send("Page.navigate", { url: `${baseUrl}/app/bank-soal` });
  await loaded;
  await new Promise((resolve) => setTimeout(resolve, 300));
  const deepLinkResult = await cdp.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `({
      title: document.title,
      hasRoot: Boolean(document.querySelector("#root")?.children.length),
      bodyText: document.body.innerText.trim()
    })`,
  });
  const deepLink = deepLinkResult.result.value;
  assert.equal(deepLink.title, "AWExam");
  assert.equal(deepLink.hasRoot, true);
  assert.ok(deepLink.bodyText.length > 20, "Deep-link menghasilkan halaman kosong.");

  cdp.close();
  console.log("✓ Browser smoke: login 320 px dan SPA deep-link lulus");
} finally {
  preview.kill("SIGTERM");
  chrome?.kill("SIGTERM");
  await rm(userDataDir, { recursive: true, force: true });
}
