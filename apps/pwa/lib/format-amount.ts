import { formatAmount as sharedFormatAmount } from "shared";

export function formatAmount(
  n: number,
  currencyCode?: string | null,
): string {
  return sharedFormatAmount(n, currencyCode ?? "USD");
}
