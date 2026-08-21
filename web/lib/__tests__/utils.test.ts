import { describe, it, expect } from "vitest";
import { cn, formatBytes, formatDate } from "../utils";

describe("cn", () => {
  it("joins class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("lets later tailwind classes win conflicts", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("drops falsy inputs", () => {
    expect(cn("a", false && "b", undefined, null, "c")).toBe("a c");
  });
});

describe("formatBytes", () => {
  it.each([
    [0, "0 B"],
    [-5, "0 B"],
    [NaN, "0 B"],
    [1, "1 B"],
    [1023, "1023 B"],
    [1024, "1 KB"],
    [1536, "1.5 KB"],
    [1048576, "1 MB"],
    [1610612736, "1.5 GB"],
    [1099511627776, "1 TB"],
  ])("formats %d as %s", (input, expected) => {
    expect(formatBytes(input)).toBe(expected);
  });

  it("caps at TB for astronomically large values", () => {
    const result = formatBytes(3 * 1024 ** 6);
    expect(result).toMatch(/TB$/);
  });
});

describe("formatDate", () => {
  it("returns N/A for empty input", () => {
    expect(formatDate("")).toBe("N/A");
  });

  it("returns N/A for unparseable input", () => {
    expect(formatDate("not-a-date")).toBe("N/A");
  });

  it("formats a valid date with month, day, and year", () => {
    const result = formatDate("2026-01-15T10:30:00Z");
    expect(result).toContain("Jan");
    expect(result).toContain("15");
    expect(result).toContain("2026");
  });
});
