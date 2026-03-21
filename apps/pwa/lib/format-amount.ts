import {
  formatAmount as sharedFormatAmount,
  formatAmountWithCurrencyCode as sharedFormatAmountWithCurrencyCode,
} from "shared";

export function formatAmount(
  n: number,
  currencyCode?: string | null,
): string {
  return sharedFormatAmount(n, currencyCode ?? "USD");
}

export function formatAmountWithCurrencyCode(
  n: number,
  currencyCode?: string | null,
): string {
  return sharedFormatAmountWithCurrencyCode(n, currencyCode ?? "USD");
}
