export type StoredAnswer = number | string;

export function isAnsweredValue(value: unknown): value is StoredAnswer {
  if (typeof value === "number") return Number.isFinite(value);
  return typeof value === "string" && value.trim().length > 0;
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
