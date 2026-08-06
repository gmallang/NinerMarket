import { describe, expect, it } from "vitest";
import { formatClockTime, formatRelativeTime } from "./format";

describe("formatRelativeTime", () => {
  it("returns an empty string for invalid dates", () => {
    expect(formatRelativeTime("not-a-date")).toBe("");
  });

  it("returns 'just now' for under a minute", () => {
    const iso = new Date(Date.now() - 30 * 1000).toISOString();
    expect(formatRelativeTime(iso)).toBe("just now");
  });

  it("returns minutes for under an hour", () => {
    const iso = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(formatRelativeTime(iso)).toBe("5m ago");
  });

  it("returns hours for under a day", () => {
    const iso = new Date(Date.now() - (3 * 60 * 60 + 5 * 60) * 1000).toISOString();
    expect(formatRelativeTime(iso)).toBe("3h ago");
  });

  it("returns days for under a week", () => {
    const iso = new Date(Date.now() - (2 * 24 * 60 * 60 + 60 * 60) * 1000).toISOString();
    expect(formatRelativeTime(iso)).toBe("2d ago");
  });

  it("returns a date for older timestamps", () => {
    const iso = new Date(2026, 0, 5, 12, 0).toISOString();
    expect(formatRelativeTime(iso)).toBe("Jan 5, 2026");
  });
});

describe("formatClockTime", () => {
  it("formats a known time", () => {
    expect(formatClockTime(new Date(2026, 0, 1, 9, 5))).toBe("9:05 AM");
    expect(formatClockTime(new Date(2026, 0, 1, 15, 0))).toBe("3:00 PM");
  });
});
