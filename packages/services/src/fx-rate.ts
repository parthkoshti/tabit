import { fxRate } from "data";
import { fetchLatestRates, fetchRatesForDate } from "./integrations/frankfurter.js";
import { ok, err, type Result } from "./types.js";

function roundTo2(n: number): number {
  return Math.round(n * 100) / 100;
}

function toYyyyMmDdUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function todayUtcYyyyMmDd(): string {
  return toYyyyMmDdUtc(new Date());
}

export type ConvertToTabInput = {
  originalAmount: number;
  from: string;
  tabCurrency: string;
  asOfDate: Date;
};

async function upsertSnapshotWithAlias(
  canonicalDate: string,
  lookupDate: string,
  base: string,
  rates: Record<string, number>,
): Promise<void> {
  await fxRate.upsertSnapshot({
    rateDate: canonicalDate,
    base,
    rates,
  });
  if (canonicalDate !== lookupDate) {
    await fxRate.upsertSnapshot({
      rateDate: lookupDate,
      base,
      rates,
    });
  }
}

/**
 * Converts `originalAmount` from `from` to `tabCurrency` using Frankfurter ECB rates.
 * Uses historical rates for `asOfDate` unless that date is in the future (then latest).
 */
export async function convertToTabCurrency(
  input: ConvertToTabInput,
): Promise<Result<{ amountTab: number; rateDate: string }>> {
  const { originalAmount, from, tabCurrency, asOfDate } = input;
  if (from === tabCurrency) {
    return ok({
      amountTab: roundTo2(originalAmount),
      rateDate: toYyyyMmDdUtc(asOfDate),
    });
  }

  const requestDate = toYyyyMmDdUtc(asOfDate);
  const today = todayUtcYyyyMmDd();
  const useLatest = requestDate > today;
  const lookupDate = useLatest ? today : requestDate;

  try {
    const cached = await fxRate.getSnapshot(lookupDate, from);
    const fromCache = cached?.rates[tabCurrency];
    if (fromCache !== undefined && Number.isFinite(fromCache)) {
      return ok({
        amountTab: roundTo2(originalAmount * fromCache),
        rateDate: lookupDate,
      });
    }

    const data = useLatest
      ? await fetchLatestRates(from, [tabCurrency])
      : await fetchRatesForDate(requestDate, from, [tabCurrency]);

    const rate = data.rates[tabCurrency];
    if (rate === undefined || !Number.isFinite(rate)) {
      return err(
        `No exchange rate from ${from} to ${tabCurrency} for this date`,
        400,
      );
    }

    await upsertSnapshotWithAlias(data.date, lookupDate, from, data.rates);

    return ok({
      amountTab: roundTo2(originalAmount * rate),
      rateDate: data.date,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return err(`Exchange rate unavailable: ${msg}`, 503);
  }
}

/**
 * Prefetch latest full rate maps for the given bases (API startup + daily cron).
 * Other expense currencies still convert on demand via `convertToTabCurrency` and cache
 * under `(rateDate, base)` where `base` is the expense currency—this warm-up only reduces
 * cold misses for these bases, not a global list of supported pairs.
 */
export async function warmLatestRatesForBases(bases: string[]): Promise<void> {
  const today = todayUtcYyyyMmDd();
  for (const base of bases) {
    try {
      const data = await fetchLatestRates(base);
      await upsertSnapshotWithAlias(data.date, today, data.base, data.rates);
    } catch {
      // best-effort warm-up
    }
  }
}
