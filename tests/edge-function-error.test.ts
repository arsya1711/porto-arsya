import assert from "node:assert/strict";
import test from "node:test";
import { edgeFunctionErrorMessage } from "../src/lib/edge-function-error";

test("membaca detail JSON dari respons Edge Function", async () => {
  const error = {
    message: "Edge Function returned a non-2xx status code",
    context: new Response(
      JSON.stringify({
        error: "A user with this email address has already been registered",
      }),
      { status: 400, headers: { "content-type": "application/json" } },
    ),
  };

  assert.equal(
    await edgeFunctionErrorMessage(error),
    "Email sudah digunakan oleh akun lain.",
  );
});

test("menerjemahkan sesi admin yang kedaluwarsa", async () => {
  const error = {
    context: new Response(JSON.stringify({ error: "Sesi tidak valid." }), {
      status: 401,
    }),
  };

  assert.equal(
    await edgeFunctionErrorMessage(error),
    "Sesi admin telah berakhir. Silakan masuk kembali.",
  );
});

test("mempertahankan pesan aman yang dikirim server", async () => {
  const error = {
    context: new Response(
      JSON.stringify({ error: "NIS siswa wajib diisi." }),
      { status: 400 },
    ),
  };

  assert.equal(
    await edgeFunctionErrorMessage(error),
    "NIS siswa wajib diisi.",
  );
});

test("mengganti error jaringan dan non-2xx generik", async () => {
  assert.equal(
    await edgeFunctionErrorMessage(
      new Error("Failed to send a request to the Edge Function"),
    ),
    "Tidak dapat terhubung ke layanan akun. Periksa koneksi lalu coba lagi.",
  );
  assert.equal(
    await edgeFunctionErrorMessage(
      new Error("Service Unavailable"),
    ),
    "Layanan server sedang tidak tersedia. Tunggu sebentar lalu coba lagi.",
  );
  assert.equal(
    await edgeFunctionErrorMessage(
      new Error("Edge Function returned a non-2xx status code"),
      "Akun belum dapat diproses.",
    ),
    "Akun belum dapat diproses.",
  );
});
