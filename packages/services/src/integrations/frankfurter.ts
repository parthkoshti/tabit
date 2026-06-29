import { log } from "otel";

const FRANKFURTER_BASE = "https://api.frankfurter.dev/v2";

type FrankfurterV2Entry = {
  date: string;
  base: string;
  quote: string;
  rate: number;
};

export type FrankfurterRatesResponse = {
  base: string;
  date: string;
  rates: Record<string, number>;
};

function parseV2Response(entries: FrankfurterV2Entry[]): FrankfurterRatesResponse {
  if (entries.length === 0) {
    throw new Error("Frankfurter returned empty rates array");
  }
  const base = entries[0].base;
  const date = entries.reduce((max, e) => (e.date > max ? e.date : max), entries[0].date);
  const rates: Record<string, number> = {};
  for (const entry of entries) {
    rates[entry.quote] = entry.rate;
  }
  return { base, date, rates };
}

async function fetchJson<T>(url: string, timeoutMs = 15_000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const start = Date.now();
  const requestStartedAt = new Date();
  log("info", "Frankfurter request started", {
    operation: "fx.frankfurter.request",
    entityType: "fx_rate_provider",
    action: "start",
    provider: "frankfurter",
    url,
    timeoutMs,
    requestStartedAt: requestStartedAt.toISOString(),
  });
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const msg = `Frankfurter HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`;
      log("error", "Frankfurter request failed", {
        operation: "fx.frankfurter.request",
        entityType: "fx_rate_provider",
        action: "error",
        provider: "frankfurter",
        url,
        status: res.status,
        requestStartedAt: requestStartedAt.toISOString(),
        requestFailedAt: new Date().toISOString(),
        durationMs: Date.now() - start,
      });
      throw new Error(msg);
    }
    log("info", "Frankfurter request completed", {
      operation: "fx.frankfurter.request",
      entityType: "fx_rate_provider",
      action: "complete",
      provider: "frankfurter",
      url,
      status: res.status,
      requestStartedAt: requestStartedAt.toISOString(),
      requestCompletedAt: new Date().toISOString(),
      durationMs: Date.now() - start,
    });
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      log("error", "Frankfurter request timed out", {
        operation: "fx.frankfurter.request",
        entityType: "fx_rate_provider",
        action: "timeout",
        provider: "frankfurter",
        url,
        timeoutMs,
        requestStartedAt: requestStartedAt.toISOString(),
        requestFailedAt: new Date().toISOString(),
        durationMs: Date.now() - start,
      });
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Latest working-day rates (updated daily ~16:00 CET per Frankfurter).
 */
export async function fetchLatestRates(
  base: string,
  quotes?: string[],
): Promise<FrankfurterRatesResponse> {
  const params = new URLSearchParams({ base });
  if (quotes?.length) {
    params.set("quotes", quotes.join(","));
  }
  const entries = await fetchJson<FrankfurterV2Entry[]>(
    `${FRANKFURTER_BASE}/rates?${params}`,
  );
  return parseV2Response(entries);
}

/**
 * Historical rates for a calendar date (ECB working day; API may return nearest date).
 */
export async function fetchRatesForDate(
  date: string,
  base: string,
  quotes?: string[],
): Promise<FrankfurterRatesResponse> {
  const params = new URLSearchParams({ base, date });
  if (quotes?.length) {
    params.set("quotes", quotes.join(","));
  }
  const entries = await fetchJson<FrankfurterV2Entry[]>(
    `${FRANKFURTER_BASE}/rates?${params}`,
  );
  return parseV2Response(entries);
}
