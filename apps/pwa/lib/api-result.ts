export function isApiFailure<R extends { success: boolean }>(
  result: R,
): result is Extract<R, { success: false }> {
  return result.success === false;
}

export function apiErrorMessage<R extends { success: boolean }>(
  result: R,
  fallback = "Request failed",
): string {
  if (isApiFailure(result) && "error" in result) {
    return String((result as { error: string }).error);
  }
  return fallback;
}
