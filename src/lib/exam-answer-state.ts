export type StoredAnswer = number | string;

export function isAnsweredValue(value: unknown): value is StoredAnswer {
  if (typeof value === "number") return Number.isFinite(value);
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Sebelum deadline, semua jawaban harus tersinkron. Sesudah deadline, attempt
 * tetap harus difinalisasi agar tidak terjebak `in_progress`; backend akan
 * menilai jawaban yang sudah sempat diterima.
 */
export function mayFinalizeAttempt(
  failedSaveCount: number,
  deadlineExpired: boolean,
): boolean {
  return failedSaveCount <= 0 || deadlineExpired;
}

export function normalizeStoredAnswers(
  value: unknown,
): Record<string, StoredAnswer> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, StoredAnswer] =>
        typeof entry[1] === "string" ||
        (typeof entry[1] === "number" && Number.isFinite(entry[1])),
    ),
  );
}

export function normalizeStoredMarks(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value.filter(
      (questionId): questionId is string =>
        typeof questionId === "string" && questionId.trim().length > 0,
    ),
  )];
}
