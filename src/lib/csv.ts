const spreadsheetFormulaPrefix = /^[\t\r ]*[=+\-@]/;

export function escapeCsvCell(value: unknown): string {
  let normalized = String(value ?? "");
  if (spreadsheetFormulaPrefix.test(normalized)) {
    normalized = `'${normalized}`;
  }
  return `"${normalized.replace(/"/g, '""')}"`;
}

export function encodeCsv(rows: readonly (readonly unknown[])[]): string {
  return rows
    .map((columns) => columns.map(escapeCsvCell).join(","))
    .join("\n");
}
