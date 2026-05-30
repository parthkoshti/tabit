import type { z } from "zod";

export function zodFieldErrors<T extends z.ZodType>(
  schema: T,
  value: unknown,
): Record<string, string> | undefined {
  const result = schema.safeParse(value);
  if (result.success) return undefined;
  const fieldErrors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined;
}
