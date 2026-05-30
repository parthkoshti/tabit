import { ORPCError } from "@orpc/server";
import type { Result } from "services";

function statusToCode(status: number): "BAD_REQUEST" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "INTERNAL_SERVER_ERROR" {
  switch (status) {
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 500:
      return "INTERNAL_SERVER_ERROR";
    default:
      return "BAD_REQUEST";
  }
}

export function unwrap<T>(result: Result<T>): T {
  if (!result.success) {
    throw new ORPCError(statusToCode(result.status), {
      message: String(result.error),
    });
  }
  return result.data;
}

export function zodFirstError(error: { flatten: () => { formErrors: string[]; fieldErrors: Record<string, string[]> } }): string {
  const flat = error.flatten();
  return (
    flat.formErrors[0] ??
    Object.values(flat.fieldErrors).flat()[0] ??
    "Invalid input"
  );
}
