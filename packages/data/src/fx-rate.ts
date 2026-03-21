import { db, fxRateSnapshot as fxRateSnapshotTable } from "db";
import { eq, and } from "drizzle-orm";
import { createId } from "shared";

export const fxRate = {
  getSnapshot: async (
    rateDate: string,
    base: string,
  ): Promise<{ rates: Record<string, number>; fetchedAt: Date } | null> => {
    const [row] = await db
      .select({
        rates: fxRateSnapshotTable.rates,
        fetchedAt: fxRateSnapshotTable.fetchedAt,
      })
      .from(fxRateSnapshotTable)
      .where(
        and(
          eq(fxRateSnapshotTable.rateDate, rateDate),
          eq(fxRateSnapshotTable.base, base),
        ),
      )
      .limit(1);
    if (!row) return null;
    return { rates: row.rates as Record<string, number>, fetchedAt: row.fetchedAt };
  },

  upsertSnapshot: async (input: {
    rateDate: string;
    base: string;
    rates: Record<string, number>;
  }): Promise<void> => {
    const existing = await db
      .select({ id: fxRateSnapshotTable.id })
      .from(fxRateSnapshotTable)
      .where(
        and(
          eq(fxRateSnapshotTable.rateDate, input.rateDate),
          eq(fxRateSnapshotTable.base, input.base),
        ),
      )
      .limit(1);
    if (existing[0]) {
      await db
        .update(fxRateSnapshotTable)
        .set({
          rates: input.rates,
          fetchedAt: new Date(),
        })
        .where(eq(fxRateSnapshotTable.id, existing[0].id));
    } else {
      await db.insert(fxRateSnapshotTable).values({
        id: createId(),
        rateDate: input.rateDate,
        base: input.base,
        rates: input.rates,
      });
    }
  },
};
