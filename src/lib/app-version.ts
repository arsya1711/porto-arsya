export function normalizeMinimumAppVersion(value: string): string | null | undefined {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^\d+\.\d+(?:\.\d+)?$/.test(trimmed) ? trimmed : undefined;
}
