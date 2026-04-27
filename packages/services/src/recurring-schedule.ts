import { DateTime } from "luxon";
import type { RecurringSchedule } from "models";

const SENTINEL_DONE = "9999-12-31";

export function resolveIanaZone(timezone: string | null | undefined): string {
  if (!timezone?.trim()) return "UTC";
  const z = timezone.trim();
  if (!DateTime.now().setZone(z).isValid) return "UTC";
  return z;
}

/** Lexicographic compare for YYYY-MM-DD keys. */
export function dateKeyCompare(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** First occurrence calendar key on or after `minKey` (inclusive). */
export function firstScheduleKeyOnOrAfter(
  schedule: RecurringSchedule,
  minKey: string,
  zone: string,
): string {
  const keys = listOccurrenceKeysInRange(schedule, minKey, SENTINEL_DONE, zone, 800);
  return keys[0] ?? SENTINEL_DONE;
}

/** Smallest occurrence key strictly after `postedKey`, or sentinel when none left within bounds. */
export function nextScheduleKeyAfter(
  schedule: RecurringSchedule,
  postedKey: string,
  zone: string,
  endsOn: string | null,
): string {
  const from = DateTime.fromISO(postedKey, { zone }).plus({ days: 1 }).toFormat("yyyy-LL-dd");
  const to = endsOn ?? SENTINEL_DONE;
  if (from > to) return SENTINEL_DONE;
  const keys = listOccurrenceKeysInRange(schedule, from, to, zone, 800);
  return keys[0] ?? SENTINEL_DONE;
}

/**
 * All schedule occurrence keys in [fromKey, toKey] (inclusive), ISO date strings in `zone`.
 */
export function listOccurrenceKeysInRange(
  schedule: RecurringSchedule,
  fromKey: string,
  toKey: string,
  zone: string,
  maxSteps = 366,
): string[] {
  if (fromKey > toKey) return [];
  if (schedule.type === "interval_days") {
    return intervalKeys(
      fromKey,
      toKey,
      schedule.anchorDate,
      schedule.intervalDays,
      zone,
      maxSteps,
    );
  }
  if (schedule.type === "monthly_nth") {
    return monthlyNthKeys(fromKey, toKey, schedule.dayOfMonth, zone, maxSteps);
  }
  return weeklyKeys(fromKey, toKey, schedule.weekdays, zone, maxSteps);
}

function intervalKeys(
  fromKey: string,
  toKey: string,
  anchorDate: string,
  intervalDays: number,
  zone: string,
  maxSteps: number,
): string[] {
  const out: string[] = [];
  let t = DateTime.fromISO(anchorDate, { zone }).startOf("day");
  const fromD = DateTime.fromISO(fromKey, { zone }).startOf("day");
  const toD = DateTime.fromISO(toKey, { zone }).startOf("day");
  if (!t.isValid || !fromD.isValid || !toD.isValid) return out;
  let guard = 0;
  while (t < fromD && guard < 20000) {
    t = t.plus({ days: intervalDays });
    guard++;
  }
  guard = 0;
  while (t <= toD && out.length < maxSteps && guard < 20000) {
    const key = t.toFormat("yyyy-LL-dd");
    if (key >= fromKey && key <= toKey) out.push(key);
    t = t.plus({ days: intervalDays });
    guard++;
  }
  return out;
}

function monthlyNthKeys(
  fromKey: string,
  toKey: string,
  dayOfMonth: number,
  zone: string,
  maxSteps: number,
): string[] {
  const out: string[] = [];
  let m = DateTime.fromISO(fromKey, { zone }).startOf("month");
  const toD = DateTime.fromISO(toKey, { zone }).startOf("day");
  if (!m.isValid || !toD.isValid) return out;
  let guard = 0;
  while (m.startOf("day") <= toD && out.length < maxSteps && guard < 500) {
    const dim = m.daysInMonth ?? 28;
    const day = Math.min(dayOfMonth, dim);
    const dt = m.set({ day });
    const key = dt.toFormat("yyyy-LL-dd");
    if (key >= fromKey && key <= toKey) out.push(key);
    m = m.plus({ months: 1 });
    guard++;
  }
  return out;
}

function weeklyKeys(
  fromKey: string,
  toKey: string,
  weekdays: number[],
  zone: string,
  maxSteps: number,
): string[] {
  const set = new Set(weekdays);
  const out: string[] = [];
  let d = DateTime.fromISO(fromKey, { zone }).startOf("day");
  const toD = DateTime.fromISO(toKey, { zone }).startOf("day");
  if (!d.isValid || !toD.isValid) return out;
  let guard = 0;
  while (d <= toD && out.length < maxSteps && guard < 400) {
    if (set.has(d.weekday)) {
      const key = d.toFormat("yyyy-LL-dd");
      if (key >= fromKey && key <= toKey) out.push(key);
    }
    d = d.plus({ days: 1 });
    guard++;
  }
  return out;
}

/** JS Date at start of calendar day in zone (for expenseDate / FX). */
export function occurrenceKeyToExpenseDate(key: string, zone: string): Date {
  const dt = DateTime.fromISO(key, { zone }).startOf("day");
  return dt.toJSDate();
}

export { SENTINEL_DONE };
