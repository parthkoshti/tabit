import { format } from "date-fns";

const MS_MIN = 60_000;
const MS_HOUR = 3_600_000;
const MS_DAY = 86_400_000;

function diffMs(input: Date | string | number): number {
  return Date.now() - new Date(input).getTime();
}

/** Always `Jan 2, 2026` (no relative wording). */
export function formatAbsoluteDate(input: Date | string | number): string {
  return format(new Date(input), "MMM d, yyyy");
}

/** Always `Jan 2, 2026, 3:45 PM`. */
export function formatAbsoluteDateTime(input: Date | string | number): string {
  return format(new Date(input), "MMM d, yyyy, h:mm a");
}

/**
 * Recent times: `Just now`, `Xm ago`, `Xh ago`.
 * Otherwise: `Jan 2, 2026`.
 */
export function formatAppDate(input: Date | string | number): string {
  const date = new Date(input);
  const diff = diffMs(input);
  if (diff < 0) return formatAbsoluteDate(date);
  if (diff < MS_MIN) return "Just now";
  if (diff < MS_HOUR) return `${Math.floor(diff / MS_MIN)}m ago`;
  if (diff < MS_DAY) return `${Math.floor(diff / MS_HOUR)}h ago`;
  return formatAbsoluteDate(date);
}

/**
 * Same relative window as {@link formatAppDate}; older times include clock time.
 */
export function formatAppDateTime(input: Date | string | number): string {
  const date = new Date(input);
  const diff = diffMs(input);
  if (diff < 0) return formatAbsoluteDateTime(date);
  if (diff < MS_MIN) return "Just now";
  if (diff < MS_HOUR) return `${Math.floor(diff / MS_MIN)}m ago`;
  if (diff < MS_DAY) return `${Math.floor(diff / MS_HOUR)}h ago`;
  return formatAbsoluteDateTime(date);
}
