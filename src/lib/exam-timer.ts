export function parseExamDeadline(value: unknown): number | null {
  const timestamp =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Date.parse(value)
        : Number.NaN;

  return Number.isFinite(timestamp) ? timestamp : null;
}

export function serverClockOffset(
  serverTime: unknown,
  clientTime = Date.now(),
): number {
  const parsed = parseExamDeadline(serverTime);
  if (parsed === null || !Number.isFinite(clientTime)) return 0;
  return parsed - clientTime;
}

export function serverAdjustedNow(offset: number, clientTime = Date.now()): number {
  if (!Number.isFinite(offset) || !Number.isFinite(clientTime)) return clientTime;
  return clientTime + offset;
}

export function remainingSecondsFromDeadline(
  deadline: number,
  now = Date.now(),
): number {
  if (!Number.isFinite(deadline) || !Number.isFinite(now)) return 0;
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

export function formatExamRemaining(value: number): string {
  const seconds = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;

  return [hours, minutes, remainder]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}
