import { describe, expect, it } from "vitest";
import { normalizeIso2, formatDate, formatDateTime } from "../lib/utils";

describe("utils", () => {
  it("normalizeIso2 returns uppercase trimmed text", () => {
    expect(normalizeIso2(" us ")).toBe("US");
    expect(normalizeIso2("Ru")).toBe("RU");
    expect(normalizeIso2(""))
      .toBe("");
    expect(normalizeIso2(null)).toBe("");
    expect(normalizeIso2(undefined)).toBe("");
  });

  it("formatDate returns YYYY-MM or a dash for empty values", () => {
    expect(formatDate("2024-04-12T11:22:33Z")).toBe("2024-04");
    expect(formatDate("")).toBe("—");
    expect(formatDate(null)).toBe("—");
  });

  it("formatDateTime returns a localized date/time value", () => {
    const formatted = formatDateTime("2024-04-12T11:22:33Z", "en-US");
    expect(formatted).toContain("2024");
    expect(formatDateTime("", "en-US")).toBe("—");
    expect(formatDateTime("invalid-date", "en-US")).toBe("invalid-date");
  });
});
