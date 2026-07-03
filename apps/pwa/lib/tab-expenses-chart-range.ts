import {
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isWithinInterval,
  min,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subMonths,
  subWeeks,
} from "date-fns";

export type TabExpensesChartRange =
  | "this-week"
  | "last-week"
  | "this-month"
  | "last-month"
  | "this-year"
  | "all-time";

export const TAB_EXPENSES_CHART_RANGE_OPTIONS: {
  value: TabExpensesChartRange;
  label: string;
}[] = [
  { value: "this-week", label: "This week" },
  { value: "last-week", label: "Last week" },
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "this-year", label: "This year" },
  { value: "all-time", label: "All time" },
];

export type ChartBucketGranularity = "day" | "month";

export function getChartGranularity(
  range: TabExpensesChartRange,
): ChartBucketGranularity {
  switch (range) {
    case "this-week":
    case "last-week":
    case "this-month":
    case "last-month":
      return "day";
    case "this-year":
    case "all-time":
      return "month";
  }
}

export function getRangeInterval(
  range: TabExpensesChartRange,
  now = new Date(),
): { start: Date; end: Date } | null {
  const today = startOfDay(now);

  switch (range) {
    case "this-week":
      return {
        start: startOfWeek(today),
        end: min([endOfWeek(today), endOfDay(now)]),
      };
    case "last-week": {
      const lastWeekStart = startOfWeek(subWeeks(today, 1));
      return { start: lastWeekStart, end: endOfWeek(lastWeekStart) };
    }
    case "this-month":
      return {
        start: startOfMonth(today),
        end: min([endOfMonth(today), endOfDay(now)]),
      };
    case "last-month": {
      const lastMonth = subMonths(today, 1);
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
    }
    case "this-year":
      return {
        start: startOfYear(today),
        end: min([endOfYear(today), endOfDay(now)]),
      };
    case "all-time":
      return null;
  }
}

export function isExpenseInRange(
  expenseDate: Date | string,
  range: TabExpensesChartRange,
  now = new Date(),
): boolean {
  const interval = getRangeInterval(range, now);
  if (!interval) return true;

  const date = startOfDay(new Date(expenseDate));
  return isWithinInterval(date, {
    start: startOfDay(interval.start),
    end: endOfDay(interval.end),
  });
}

export function listBucketKeys(
  range: TabExpensesChartRange,
  now = new Date(),
): string[] {
  if (range === "all-time") return [];

  const interval = getRangeInterval(range, now);
  if (!interval) return [];

  const granularity = getChartGranularity(range);
  if (granularity === "day") {
    return eachDayOfInterval({
      start: startOfDay(interval.start),
      end: startOfDay(interval.end),
    }).map((date) => format(date, "yyyy-MM-dd"));
  }

  return eachMonthOfInterval({
    start: startOfMonth(interval.start),
    end: startOfMonth(interval.end),
  }).map((date) => format(date, "yyyy-MM"));
}

export function expenseToBucketKey(
  expenseDate: Date | string,
  granularity: ChartBucketGranularity,
): string {
  const date = new Date(expenseDate);
  if (granularity === "day") {
    return format(startOfDay(date), "yyyy-MM-dd");
  }
  return format(date, "yyyy-MM");
}

export function formatBucketLabel(
  bucketKey: string,
  granularity: ChartBucketGranularity,
  range: TabExpensesChartRange,
): string {
  if (granularity === "month") {
    const [year, month] = bucketKey.split("-");
    return format(new Date(Number(year), Number(month) - 1, 1), "MMM");
  }

  const date = new Date(`${bucketKey}T12:00:00`);
  if (range === "this-week" || range === "last-week") {
    return format(date, "EEE");
  }
  return format(date, "MMM d");
}
