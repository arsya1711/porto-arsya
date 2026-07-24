const DEFAULT_TIME_ZONE = "Asia/Jakarta";

function partsInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function offsetAt(instant: number, timeZone: string) {
  const part = partsInTimeZone(new Date(instant), timeZone);
  const representedAsUtc = Date.UTC(
    Number(part.year),
    Number(part.month) - 1,
    Number(part.day),
    Number(part.hour),
    Number(part.minute),
    Number(part.second),
  );
  return representedAsUtc - instant;
}

export function schoolDateTimeToIso(
  value: string,
  timeZone = DEFAULT_TIME_ZONE,
) {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const wallAsUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );
  let instant = wallAsUtc - offsetAt(wallAsUtc, timeZone);
  instant = wallAsUtc - offsetAt(instant, timeZone);
  return Number.isFinite(instant) ? new Date(instant).toISOString() : null;
}

export function isoToSchoolDateTimeInput(
  value: string | null | undefined,
  timeZone = DEFAULT_TIME_ZONE,
) {
  const date = value ? new Date(value) : new Date(Date.now() + 60 * 60 * 1000);
  if (Number.isNaN(date.getTime())) return "";
  const part = partsInTimeZone(date, timeZone);
  return `${part.year}-${part.month}-${part.day}T${part.hour}:${part.minute}`;
}
