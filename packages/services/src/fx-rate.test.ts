import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fxRate } from "data";
import { convertToTabCurrency, warmLatestRatesForBases } from "./fx-rate.js";

describe("convertToTabCurrency", () => {
  beforeEach(() => {
    vi.mocked(fxRate.getSnapshot).mockReset();
    vi.mocked(fxRate.upsertSnapshot).mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns same amount when currencies match", async () => {
    const r = await convertToTabCurrency({
      originalAmount: 42.5,
      from: "USD",
      tabCurrency: "USD",
      asOfDate: new Date("2024-06-01T12:00:00.000Z"),
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.amountTab).toBe(42.5);
      expect(r.data.rateDate).toBe("2024-06-01");
    }
    expect(fxRate.getSnapshot).not.toHaveBeenCalled();
  });

  it("uses cache when snapshot exists", async () => {
    vi.mocked(fxRate.getSnapshot).mockResolvedValue({
      rates: { USD: 1.1 },
      fetchedAt: new Date(),
    });

    const r = await convertToTabCurrency({
      originalAmount: 100,
      from: "EUR",
      tabCurrency: "USD",
      asOfDate: new Date("2024-06-01T00:00:00.000Z"),
    });

    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.amountTab).toBe(110);
    }
    expect(fxRate.getSnapshot).toHaveBeenCalled();
  });

  it("fetches Frankfurter when cache misses and upserts", async () => {
    vi.mocked(fxRate.getSnapshot).mockResolvedValue(null);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            amount: 1,
            base: "EUR",
            date: "2024-06-03",
            rates: { USD: 1.08 },
          }),
      }),
    );

    const r = await convertToTabCurrency({
      originalAmount: 100,
      from: "EUR",
      tabCurrency: "USD",
      asOfDate: new Date("2024-06-03T12:00:00.000Z"),
    });

    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.amountTab).toBe(108);
      expect(r.data.rateDate).toBe("2024-06-03");
    }
    expect(fxRate.upsertSnapshot).toHaveBeenCalled();
  });
});

describe("warmLatestRatesForBases", () => {
  beforeEach(() => {
    vi.mocked(fxRate.upsertSnapshot).mockReset();
  });

  it("fetches and upserts for each base", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            amount: 1,
            base: "EUR",
            date: "2024-06-03",
            rates: { USD: 1.08 },
          }),
      }),
    );

    await warmLatestRatesForBases(["EUR"]);

    expect(fxRate.upsertSnapshot).toHaveBeenCalled();
  });
});
