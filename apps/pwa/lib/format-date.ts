import { differenceInCalendarDays, format } from "date-fns";

const MS_MIN = 60_000;
const MS_HOUR = 3_600_000;
const MS_DAY = 86_400_000;

const INVALID_PLACEHOLDER = "—";

function toValidDate(
  input: Date | string | number | null | undefined,
): Date | null {
  if (input == null) return null;
  const d = input instanceof Date ? input : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

function diffMs(input: Date | string | number): number {
  return Date.now() - new Date(input).getTime();
}

/** Always `Jan 2, 2026` (no relative wording). */
export function formatAbsoluteDate(
  input: Date | string | number | null | undefined,
): string {
  const date = toValidDate(input);
  if (!date) return INVALID_PLACEHOLDER;
  return format(date, "MMM d, yyyy");
}

/**
 * Calendar-day labels for pickers: Today, Yesterday, N days ago; future: Tomorrow, in N days.
 * Falls back to {@link formatAbsoluteDate} for dates more than a week away.
 */
export function formatRelativeCalendarDate(
  input: Date | string | number | null | undefined,
): string {
  const date = toValidDate(input);
  if (!date) return INVALID_PLACEHOLDER;
  const diff = differenceInCalendarDays(new Date(), date);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff > 1 && diff <= 7) return `${diff} days ago`;
  if (diff < 0) {
    const ahead = -diff;
    if (ahead === 1) return "Tomorrow";
    if (ahead <= 7) return `in ${ahead} days`;
  }
  return formatAbsoluteDate(date);
}

/** Always `Jan 2, 2026, 3:45 PM`. */
export function formatAbsoluteDateTime(
  input: Date | string | number | null | undefined,
): string {
  const date = toValidDate(input);
  if (!date) return INVALID_PLACEHOLDER;
  return format(date, "MMM d, yyyy, h:mm a");
}

/**
 * Recent times: `Just now`, `Xm ago`, `Xh ago`.
 * Otherwise: `Jan 2, 2026`.
 */
export function formatAppDate(
  input: Date | string | number | null | undefined,
): string {
  const date = toValidDate(input);
  if (!date) return INVALID_PLACEHOLDER;
  const diff = diffMs(date);
  if (diff < 0) return formatAbsoluteDate(date);
  if (diff < MS_MIN) return "Just now";
  if (diff < MS_HOUR) return `${Math.floor(diff / MS_MIN)}m ago`;
  if (diff < MS_DAY) return `${Math.floor(diff / MS_HOUR)}h ago`;
  return formatAbsoluteDate(date);
}

/**
 * Same relative window as {@link formatAppDate}; older times include clock time.
 */
export function formatAppDateTime(
  input: Date | string | number | null | undefined,
): string {
  const date = toValidDate(input);
  if (!date) return INVALID_PLACEHOLDER;
  const diff = diffMs(date);
  if (diff < 0) return formatAbsoluteDateTime(date);
  if (diff < MS_MIN) return "Just now";
  if (diff < MS_HOUR) return `${Math.floor(diff / MS_MIN)}m ago`;
  if (diff < MS_DAY) return `${Math.floor(diff / MS_HOUR)}h ago`;
  return formatAbsoluteDateTime(date);
}
