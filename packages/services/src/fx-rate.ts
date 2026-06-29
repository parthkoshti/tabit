import { fxRate } from "data";
import { log, withSpan } from "otel";
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
  const conversionStart = Date.now();
  const requestDate = toYyyyMmDdUtc(asOfDate);
  return withSpan(
    "fx.convert_to_tab_currency",
    {
      "fx.from": from,
      "fx.to": tabCurrency,
      "fx.original_amount": originalAmount,
      "fx.request_date": requestDate,
    },
    async (span) => {
      log("info", "FX conversion started", {
        operation: "fx.convert",
        entityType: "fx_rate",
        action: "start",
        from,
        to: tabCurrency,
        originalAmount,
        requestDate,
      });

  if (from === tabCurrency) {
    const amountTab = roundTo2(originalAmount);
    span.setAttribute("fx.cache_status", "not_needed");
    span.setAttribute("fx.amount_tab", amountTab);
    span.setAttribute("fx.rate_date", requestDate);
    log("info", "FX conversion completed without exchange", {
      operation: "fx.convert",
      entityType: "fx_rate",
      action: "complete",
      from,
      to: tabCurrency,
      originalAmount,
      amountTab,
      rateDate: requestDate,
      cacheStatus: "not_needed",
      durationMs: Date.now() - conversionStart,
    });
    return ok({
      amountTab,
      rateDate: requestDate,
    });
  }

  const today = todayUtcYyyyMmDd();
  const useLatest = requestDate > today;
  const lookupDate = useLatest ? today : requestDate;
  span.setAttribute("fx.lookup_date", lookupDate);
  span.setAttribute("fx.use_latest", useLatest);

  // Today's rates can change (ECB publishes ~16:00 CET daily); treat cache as
  // stale after 12 hours so on-demand fetches for non-warmed bases stay fresh.
  // Historical dates never change so they are cached indefinitely.
  const TODAY_TTL_MS = 12 * 60 * 60 * 1000;

  try {
    const cached = await fxRate.getSnapshot(lookupDate, from);
    const fromCache = cached?.rates[tabCurrency];
    const isTodayStale =
      lookupDate === today &&
      cached != null &&
      Date.now() - cached.fetchedAt.getTime() > TODAY_TTL_MS;
    if (fromCache !== undefined && Number.isFinite(fromCache) && !isTodayStale) {
      const amountTab = roundTo2(originalAmount * fromCache);
      span.setAttribute("fx.cache_status", "hit");
      span.setAttribute("fx.rate", fromCache);
      span.setAttribute("fx.amount_tab", amountTab);
      span.setAttribute("fx.rate_date", lookupDate);
      log("info", "FX rate cache hit", {
        operation: "fx.convert",
        entityType: "fx_rate",
        action: "cache_hit",
        from,
        to: tabCurrency,
        originalAmount,
        amountTab,
        requestDate,
        lookupDate,
        rateDate: lookupDate,
        rate: fromCache,
        durationMs: Date.now() - conversionStart,
      });
      return ok({
        amountTab,
        rateDate: lookupDate,
      });
    }

    if (isTodayStale) {
      span.setAttribute("fx.cache_status", "stale");
      log("info", "FX rate cache stale, refetching", {
        operation: "fx.convert",
        entityType: "fx_rate",
        action: "cache_stale",
        from,
        to: tabCurrency,
        requestDate,
        lookupDate,
        cachedFetchedAt: cached?.fetchedAt.toISOString(),
      });
    } else {
      span.setAttribute("fx.cache_status", "miss");
      log("info", "FX rate cache miss, fetching from Frankfurter", {
        operation: "fx.convert",
        entityType: "fx_rate",
        action: "cache_miss",
        from,
        to: tabCurrency,
        requestDate,
        lookupDate,
        useLatest,
      });
    }

    const data = useLatest
      ? await fetchLatestRates(from, [tabCurrency])
      : await fetchRatesForDate(requestDate, from, [tabCurrency]);

    const rate = data.rates[tabCurrency];
    if (rate === undefined || !Number.isFinite(rate)) {
      log("warn", "FX rate not found in Frankfurter response", {
        operation: "fx.convert",
        entityType: "fx_rate",
        action: "missing_rate",
        from,
        to: tabCurrency,
        requestDate,
        lookupDate,
        frankfurterRateDate: data.date,
        durationMs: Date.now() - conversionStart,
      });
      return err(
        `No exchange rate from ${from} to ${tabCurrency} for this date`,
        400,
      );
    }

    const amountTab = roundTo2(originalAmount * rate);
    span.setAttribute("fx.rate", rate);
    span.setAttribute("fx.amount_tab", amountTab);
    span.setAttribute("fx.rate_date", data.date);
    log("info", "FX rate fetched and cached", {
      operation: "fx.convert",
      entityType: "fx_rate",
      action: "fetched",
      from,
      to: tabCurrency,
      originalAmount,
      amountTab,
      requestDate,
      lookupDate,
      rateDate: data.date,
      rate,
      durationMs: Date.now() - conversionStart,
    });
    await upsertSnapshotWithAlias(data.date, lookupDate, from, data.rates);

    return ok({
      amountTab,
      rateDate: data.date,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("error", "FX rate fetch failed", {
      operation: "fx.convert",
      entityType: "fx_rate",
      action: "error",
      from,
      to: tabCurrency,
      requestDate,
      lookupDate,
      error: msg,
      durationMs: Date.now() - conversionStart,
    });
    return err(`Exchange rate unavailable: ${msg}`, 503);
  }
    },
  );
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
