import {
  formatAmount as sharedFormatAmount,
  formatAmountWithCurrencyCode as sharedFormatAmountWithCurrencyCode,
  getCurrency,
  CURRENCIES,
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

/** Compact display for chart tooltips: e.g. ₹45.9k when amount >= 1000. */
export function formatCompactAmount(
  n: number,
  currencyCode?: string | null,
): string {
  const abs = Math.abs(n);
  if (abs < 1000) {
    return formatAmount(n, currencyCode);
  }

  const currency = getCurrency(currencyCode ?? "USD") ?? CURRENCIES.USD;
  const sign = n < 0 ? "-" : "";
  const compact = (abs / 1000).toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${sign}${currency.symbol}${compact}k`;
}
