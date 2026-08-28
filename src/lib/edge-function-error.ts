type ErrorPayload = {
  error?: unknown;
  message?: unknown;
  msg?: unknown;
};

function payloadMessage(payload: unknown): string | null {
  if (typeof payload === "string") {
    const message = payload.trim();
    if (!message) return null;
    try {
      return payloadMessage(JSON.parse(message)) ?? message;
    } catch {
      return message;
    }
  }
  if (!payload || typeof payload !== "object") return null;

  const candidate = payload as ErrorPayload;
  return (
    payloadMessage(candidate.error) ??
    payloadMessage(candidate.message) ??
    payloadMessage(candidate.msg)
  );
}

function friendlyMessage(message: string, fallback: string): string {
  const normalized = message.trim();
  const lower = normalized.toLowerCase();

  if (
    /already (been )?registered/.test(lower) ||
    /email.*already (exists|registered|used)/.test(lower) ||
    /user.*already exists/.test(lower)
  ) {
    return "Email sudah digunakan oleh akun lain.";
  }
  if (
    lower.includes("invalid email") ||
    lower.includes("email address is invalid")
  ) {
    return "Format email tidak valid.";
  }
  if (
    lower.includes("password") &&
    (lower.includes("least") ||
      lower.includes("short") ||
      lower.includes("character"))
  ) {
    return "Kata sandi harus terdiri dari minimal 8 karakter.";
  }
  if (
    lower.includes("jwt expired") ||
    lower.includes("token has expired") ||
    lower.includes("invalid jwt") ||
    lower.includes("sesi tidak ditemukan") ||
    lower.includes("sesi tidak valid")
  ) {
    return "Sesi admin telah berakhir. Silakan masuk kembali.";
  }
  if (lower.includes("origin tidak diizinkan")) {
    return "Alamat aplikasi tidak diizinkan mengakses layanan admin.";
  }
  if (
    lower.includes("service unavailable") ||
    lower.includes("temporarily unavailable") ||
    lower.includes("server is unavailable") ||
    lower.includes("internal server error")
  ) {
    return "Layanan server sedang tidak tersedia. Tunggu sebentar lalu coba lagi.";
  }
  if (
    lower.includes("failed to fetch") ||
    lower.includes("failed to send a request") ||
    lower.includes("network") ||
    lower.includes("functionsrelayerror")
  ) {
    return "Tidak dapat terhubung ke layanan akun. Periksa koneksi lalu coba lagi.";
  }
  if (
    lower.includes("edge function") ||
    lower.includes("non-2xx status code")
  ) {
    return fallback;
  }
  return normalized || fallback;
}

async function contextMessage(context: unknown): Promise<string | null> {
  if (!context || typeof context !== "object") return payloadMessage(context);

  const embedded = payloadMessage((context as ErrorPayload).error);
  if (embedded) return embedded;

  const response = context as {
    clone?: () => unknown;
    json?: () => Promise<unknown>;
    text?: () => Promise<string>;
  };
  const jsonReadable =
    typeof response.clone === "function" ? response.clone() : response;
  if (!jsonReadable || typeof jsonReadable !== "object") return null;

  const jsonBody = jsonReadable as { json?: () => Promise<unknown> };
  if (typeof jsonBody.json === "function") {
    try {
      const message = payloadMessage(await jsonBody.json());
      if (message) return message;
    } catch {
      // Respons non-JSON tetap dicoba sebagai teks.
    }
  }

  const textReadable =
    typeof response.clone === "function" ? response.clone() : response;
  const textBody = textReadable as { text?: () => Promise<string> };
  if (typeof textBody.text === "function") {
    try {
      return payloadMessage(await textBody.text());
    } catch {
      return null;
    }
  }
  return null;
}

export async function edgeFunctionErrorMessage(
  error: unknown,
  fallback = "Permintaan akun gagal. Silakan coba lagi.",
): Promise<string> {
  if (error && typeof error === "object" && "context" in error) {
    const detail = await contextMessage(
      (error as { context?: unknown }).context,
    );
    if (detail) return friendlyMessage(detail, fallback);
  }

  const message =
    error instanceof Error ? error.message : payloadMessage(error);
  return message ? friendlyMessage(message, fallback) : fallback;
}
