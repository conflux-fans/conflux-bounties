"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toCsv = toCsv;
/**
 * Convert an array of metric rows to CSV format.
 * First row is the header; subsequent rows are data.
 */
function toCsv(rows) {
    if (rows.length === 0)
        return "";
    const firstRow = rows[0];
    const headers = Object.keys(firstRow);
    const lines = [headers.join(",")];
    for (const row of rows) {
        const values = headers.map((h) => {
            const val = row[h];
            if (val === null || val === undefined)
                return "";
            if (typeof val === "string" && (val.includes(",") || val.includes('"'))) {
                return `"${val.replace(/"/g, '""')}"`;
            }
            return String(val);
        });
        lines.push(values.join(","));
    }
    return lines.join("\n");
}
//# sourceMappingURL=csvExporter.js.map