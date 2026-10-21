import { describe, expect, it } from "vitest";
import { FREE_DAILY_FILLS, fillLimitForPlan } from "../shared/schema";
import {
  canFill,
  localDateKey,
  normalizeDailyUsage,
  recordDailyFill,
  remainingFills
} from "../src/shared/usage";

describe("daily fill usage", () => {
  const noon = new Date(2026, 9, 20, 12, 0, 0);

  it("uses the local calendar day", () => {
    expect(localDateKey(noon)).toBe("2026-10-20");
    expect(localDateKey(new Date(2026, 9, 20, 23, 59, 59))).toBe("2026-10-20");
  });

  it("resets when the stored day is not today", () => {
    expect(normalizeDailyUsage({ date: "2026-10-19", count: 4 }, noon)).toEqual({
      date: "2026-10-20",
      count: 0
    });
  });

  it("ignores malformed counts", () => {
    expect(normalizeDailyUsage({ date: "2026-10-20", count: -3 }, noon).count).toBe(0);
    expect(normalizeDailyUsage({ date: "2026-10-20", count: "x" }, noon).count).toBe(0);
    expect(normalizeDailyUsage(null, noon)).toEqual({ date: "2026-10-20", count: 0 });
  });

  it("counts fills for the current day", () => {
    const usage = recordDailyFill({ date: "2026-10-20", count: 2 }, noon);
    expect(usage).toEqual({ date: "2026-10-20", count: 3 });
  });

  it("allows free fills until the daily limit", () => {
    expect(canFill({ date: "2026-10-20", count: FREE_DAILY_FILLS - 1 }, "free", noon)).toBe(true);
    expect(canFill({ date: "2026-10-20", count: FREE_DAILY_FILLS }, "free", noon)).toBe(false);
    expect(canFill({ date: "2026-10-20", count: 999 }, "paid", noon)).toBe(true);
  });

  it("reports remaining fills", () => {
    expect(remainingFills({ date: "2026-10-20", count: 2 }, "free", noon)).toBe(3);
    expect(remainingFills({ date: "2026-10-20", count: 2 }, "paid", noon)).toBeNull();
  });

  it("keeps paid access unlimited", () => {
    expect(fillLimitForPlan("paid")).toBe(Number.POSITIVE_INFINITY);
    expect(fillLimitForPlan("free")).toBe(FREE_DAILY_FILLS);
  });
});
