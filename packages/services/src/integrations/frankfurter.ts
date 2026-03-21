const FRANKFURTER_BASE = "https://api.frankfurter.dev/v1";

export type FrankfurterRatesResponse = {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
};

async function fetchJson<T>(url: string, timeoutMs = 15_000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Frankfurter HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`,
      );
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Latest working-day rates (updated daily ~16:00 CET per Frankfurter).
 */
export async function fetchLatestRates(
  base: string,
  symbols?: string[],
): Promise<FrankfurterRatesResponse> {
  const params = new URLSearchParams({ base });
  if (symbols?.length) {
    params.set("symbols", symbols.join(","));
  }
  return fetchJson<FrankfurterRatesResponse>(
    `${FRANKFURTER_BASE}/latest?${params}`,
  );
}

/**
 * Historical rates for a calendar date (ECB working day; API may return nearest date).
 */
export async function fetchRatesForDate(
  date: string,
  base: string,
  symbols?: string[],
): Promise<FrankfurterRatesResponse> {
  const params = new URLSearchParams({ base });
  if (symbols?.length) {
    params.set("symbols", symbols.join(","));
  }
  return fetchJson<FrankfurterRatesResponse>(
    `${FRANKFURTER_BASE}/${date}?${params}`,
  );
}
