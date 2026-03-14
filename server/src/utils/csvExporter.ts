/**
 * Convert an array of metric rows to CSV format.
 * First row is the header; subsequent rows are data.
 */
export function toCsv(
  rows: Array<Record<string, string | number | boolean | null>>
): string {
  if (rows.length === 0) return "";

  const firstRow = rows[0]!;
  const headers = Object.keys(firstRow);
  const lines: string[] = [headers.join(",")];

  for (const row of rows) {
    const values = headers.map((h) => {
      const val = row[h];
      if (val === null || val === undefined) return "";
      if (typeof val === "string" && (val.includes(",") || val.includes('"'))) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return String(val);
    });
    lines.push(values.join(","));
  }

  return lines.join("\n");
}
