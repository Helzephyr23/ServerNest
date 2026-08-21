import { describe, it, expect } from "vitest";
import {
  SOFTWARE_OPTIONS,
  RAM_OPTIONS,
  FALLBACK_VERSIONS,
} from "../constants";

describe("SOFTWARE_OPTIONS", () => {
  it("has unique ids", () => {
    const ids = SOFTWARE_OPTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("always includes vanilla as the first option", () => {
    expect(SOFTWARE_OPTIONS[0].id).toBe("vanilla");
  });

  it("gives every option a name and description", () => {
    for (const opt of SOFTWARE_OPTIONS) {
      expect(opt.name.trim()).not.toBe("");
      expect(opt.desc.trim()).not.toBe("");
    }
  });
});

describe("RAM_OPTIONS", () => {
  it("is strictly increasing with no duplicates", () => {
    for (let i = 1; i < RAM_OPTIONS.length; i++) {
      expect(RAM_OPTIONS[i]).toBeGreaterThan(RAM_OPTIONS[i - 1]);
    }
  });

  it("contains only whole gigabyte multiples of at least 1 GB", () => {
    for (const mb of RAM_OPTIONS) {
      expect(mb % 1024).toBe(0);
      expect(mb).toBeGreaterThanOrEqual(1024);
    }
  });
});

describe("FALLBACK_VERSIONS", () => {
  it("contains only valid minecraft version strings", () => {
    const versionPattern = /^\d+\.\d+(\.\d+)?$/;
    for (const v of FALLBACK_VERSIONS) {
      expect(v).toMatch(versionPattern);
    }
  });

  it("has no duplicates", () => {
    expect(new Set(FALLBACK_VERSIONS).size).toBe(FALLBACK_VERSIONS.length);
  });

  it("starts with the newest version", () => {
    expect(FALLBACK_VERSIONS[0]).toMatch(/^1\.21/);
  });
});
