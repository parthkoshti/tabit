import { describe, test, expect } from "vitest";
import {
  listOccurrenceKeysInRange,
  nextScheduleKeyAfter,
  firstScheduleKeyOnOrAfter,
  dateKeyCompare,
  SENTINEL_DONE,
} from "./recurring-schedule.js";

describe("recurring-schedule", () => {
  test("dateKeyCompare orders ISO dates", () => {
    expect(dateKeyCompare("2026-01-01", "2026-01-02")).toBeLessThan(0);
    expect(dateKeyCompare("2026-02-01", "2026-01-31")).toBeGreaterThan(0);
  });

  test("interval_days lists keys in range", () => {
    const keys = listOccurrenceKeysInRange(
      { type: "interval_days", intervalDays: 7, anchorDate: "2026-01-01" },
      "2026-01-01",
      "2026-01-22",
      "UTC",
    );
    expect(keys).toEqual(["2026-01-01", "2026-01-08", "2026-01-15", "2026-01-22"]);
  });

  test("monthly_nth clamps to last day in February", () => {
    const keys = listOccurrenceKeysInRange(
      { type: "monthly_nth", dayOfMonth: 31 },
      "2026-02-01",
      "2026-03-31",
      "UTC",
    );
    expect(keys).toContain("2026-02-28");
    expect(keys).toContain("2026-03-31");
  });

  test("weekly lists selected weekdays only", () => {
    const keys = listOccurrenceKeysInRange(
      { type: "weekly", weekdays: [1, 3] },
      "2026-01-05",
      "2026-01-11",
      "UTC",
    );
    expect(keys).toEqual(["2026-01-05", "2026-01-07"]);
  });

  test("nextScheduleKeyAfter advances past posted day", () => {
    const next = nextScheduleKeyAfter(
      { type: "interval_days", intervalDays: 1, anchorDate: "2026-04-01" },
      "2026-04-05",
      "UTC",
      null,
    );
    expect(next).toBe("2026-04-06");
  });

  test("firstScheduleKeyOnOrAfter picks first grid point on or after min", () => {
    const first = firstScheduleKeyOnOrAfter(
      { type: "interval_days", intervalDays: 7, anchorDate: "2026-01-03" },
      "2026-01-01",
      "UTC",
    );
    expect(first).toBe("2026-01-03");
  });

  test("nextScheduleKeyAfter returns sentinel when past end", () => {
    const next = nextScheduleKeyAfter(
      { type: "interval_days", intervalDays: 1, anchorDate: "2026-01-01" },
      "2026-01-10",
      "UTC",
      "2026-01-05",
    );
    expect(next).toBe(SENTINEL_DONE);
  });
});
