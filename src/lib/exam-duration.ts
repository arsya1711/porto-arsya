export type ExamDurationValue = number | "";

export function parseExamDurationInput(value: string): ExamDurationValue {
  if (value === "") return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : "";
}

export function isValidExamDuration(
  value: ExamDurationValue,
): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1
  );
}
