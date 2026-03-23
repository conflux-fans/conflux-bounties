import { toCsv } from "./csvExporter";

describe("toCsv", () => {
  it("returns empty string for empty array", () => {
    expect(toCsv([])).toBe("");
  });

  it("converts rows to CSV with headers", () => {
    const rows = [
      { name: "Alice", age: 30, active: true },
      { name: "Bob", age: 25, active: false },
    ];

    const csv = toCsv(rows);
    const lines = csv.split("\n");

    expect(lines[0]).toBe("name,age,active");
    expect(lines[1]).toBe("Alice,30,true");
    expect(lines[2]).toBe("Bob,25,false");
  });

  it("handles null values", () => {
    const rows = [{ name: "Alice", email: null }];
    const csv = toCsv(rows);
    expect(csv).toBe("name,email\nAlice,");
  });

  it("quotes strings containing commas", () => {
    const rows = [{ desc: "hello, world" }];
    const csv = toCsv(rows);
    expect(csv).toContain('"hello, world"');
  });

  it("escapes double quotes within strings", () => {
    const rows = [{ desc: 'say "hello"' }];
    const csv = toCsv(rows);
    expect(csv).toContain('"say ""hello"""');
  });
});
