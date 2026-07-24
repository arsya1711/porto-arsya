import type { ExamStatus } from "../types";

export function deriveExamStatus(
  stored: ExamStatus,
  startsAt: string,
  endsAt: string | null,
  durationMinutes: number,
  now = Date.now(),
): ExamStatus {
  if (stored === "draft") return "draft";

  const start = new Date(startsAt).getTime();
  const explicitEnd = endsAt ? new Date(endsAt).getTime() : Number.NaN;
  const calculatedEnd = start + Math.max(0, durationMinutes) * 60_000;
  const end = Number.isFinite(explicitEnd) ? explicitEnd : calculatedEnd;

  if (!Number.isFinite(start) || !Number.isFinite(end)) return stored;
  if (now < start) return "terjadwal";
  if (now <= end) return "berlangsung";
  return "selesai";
}
