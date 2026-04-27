import {
  db,
  recurringExpenseRule as ruleTable,
  recurringExpenseOccurrence as occurrenceTable,
} from "db";
import { eq, and, lte, sql } from "drizzle-orm";
import { createId } from "shared";
import { expense, type CreateExpenseInput } from "./expense.js";

export type RecurringRuleRow = {
  id: string;
  tabId: string;
  ownerUserId: string;
  status: string;
  schedule: unknown;
  template: unknown;
  startsOn: string;
  endsOn: string | null;
  maxCount: number | null;
  postedCount: number;
  nextDueKey: string;
  pausedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type InsertRecurringRuleInput = Omit<
  RecurringRuleRow,
  "id" | "createdAt" | "updatedAt" | "pausedAt"
> & { id?: string };

export const recurringExpense = {
  insertRule: async (input: InsertRecurringRuleInput): Promise<string> => {
    const id = input.id ?? createId();
    await db.insert(ruleTable).values({
      id,
      tabId: input.tabId,
      ownerUserId: input.ownerUserId,
      status: input.status,
      schedule: input.schedule,
      template: input.template,
      startsOn: input.startsOn,
      endsOn: input.endsOn,
      maxCount: input.maxCount,
      postedCount: input.postedCount,
      nextDueKey: input.nextDueKey,
      pausedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return id;
  },

  updateRule: async (
    ruleId: string,
    patch: Partial<{
      schedule: unknown;
      template: unknown;
      startsOn: string;
      endsOn: string | null;
      maxCount: number | null;
      status: string;
      postedCount: number;
      nextDueKey: string;
      pausedAt: Date | null;
    }>,
  ): Promise<void> => {
    await db
      .update(ruleTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(ruleTable.id, ruleId));
  },

  getById: async (ruleId: string): Promise<RecurringRuleRow | null> => {
    const [row] = await db.select().from(ruleTable).where(eq(ruleTable.id, ruleId)).limit(1);
    if (!row) return null;
    return row as RecurringRuleRow;
  },

  listByTabId: async (tabId: string): Promise<RecurringRuleRow[]> => {
    const rows = await db.select().from(ruleTable).where(eq(ruleTable.tabId, tabId));
    return rows as RecurringRuleRow[];
  },

  deleteRule: async (ruleId: string): Promise<void> => {
    await db.delete(ruleTable).where(eq(ruleTable.id, ruleId));
  },

  getPostedCount: async (ruleId: string): Promise<number> => {
    const [r] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(occurrenceTable)
      .where(eq(occurrenceTable.ruleId, ruleId));
    return r?.c ?? 0;
  },

  /** Active rules whose next due date (YYYY-MM-DD) is on or before `todayKey` (same TZ as keys). */
  listDueActiveRules: async (todayKey: string): Promise<RecurringRuleRow[]> => {
    const rows = await db
      .select()
      .from(ruleTable)
      .where(and(eq(ruleTable.status, "active"), lte(ruleTable.nextDueKey, todayKey)));
    return rows as RecurringRuleRow[];
  },

  /** All active rules (cron filters by owner-local today in the service). */
  listAllActiveRules: async (): Promise<RecurringRuleRow[]> => {
    const rows = await db.select().from(ruleTable).where(eq(ruleTable.status, "active"));
    return rows as RecurringRuleRow[];
  },

  /**
   * Reserve occurrence (idempotent), insert expense + audit in one transaction, link occurrence to expense.
   * Returns null if occurrence already existed (skip).
   */
  getOccurrenceExpenseId: async (
    ruleId: string,
    occurrenceKey: string,
  ): Promise<string | null> => {
    const [row] = await db
      .select({ expenseId: occurrenceTable.expenseId })
      .from(occurrenceTable)
      .where(
        and(eq(occurrenceTable.ruleId, ruleId), eq(occurrenceTable.occurrenceKey, occurrenceKey)),
      )
      .limit(1);
    return row?.expenseId ?? null;
  },

  /**
   * Insert rule, expense (with recurringRuleId), and occurrence in one transaction.
   * Used when the user saves an expense and attaches a new recurring rule in the same request.
   */
  insertRuleAndExpenseInTransaction: async (
    ruleInput: InsertRecurringRuleInput,
    expenseInput: CreateExpenseInput,
    occurrenceKey: string,
  ): Promise<{ expenseId: string; ruleId: string }> => {
    return db.transaction(async (tx) => {
      const ruleId = ruleInput.id ?? createId();
      await tx.insert(ruleTable).values({
        id: ruleId,
        tabId: ruleInput.tabId,
        ownerUserId: ruleInput.ownerUserId,
        status: ruleInput.status,
        schedule: ruleInput.schedule,
        template: ruleInput.template,
        startsOn: ruleInput.startsOn,
        endsOn: ruleInput.endsOn,
        maxCount: ruleInput.maxCount,
        postedCount: ruleInput.postedCount,
        nextDueKey: ruleInput.nextDueKey,
        pausedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const expenseId = await expense.insertWithClient(tx as unknown as typeof db, {
        ...expenseInput,
        recurringRuleId: ruleId,
      });

      await tx.insert(occurrenceTable).values({
        id: createId(),
        ruleId,
        occurrenceKey,
        expenseId,
      });

      return { expenseId, ruleId };
    });
  },

  tryPostOccurrence: async (
    ruleId: string,
    occurrenceKey: string,
    expenseInput: CreateExpenseInput,
  ): Promise<{ expenseId: string } | null> => {
    return db.transaction(async (tx) => {
      const occInsert = await tx
        .insert(occurrenceTable)
        .values({
          id: createId(),
          ruleId,
          occurrenceKey,
          expenseId: null,
        })
        .onConflictDoNothing({
          target: [occurrenceTable.ruleId, occurrenceTable.occurrenceKey],
        })
        .returning({ id: occurrenceTable.id });

      if (occInsert.length === 0) {
        return null;
      }

      const expenseId = await expense.insertWithClient(tx as unknown as typeof db, expenseInput);

      await tx
        .update(occurrenceTable)
        .set({ expenseId })
        .where(
          and(
            eq(occurrenceTable.ruleId, ruleId),
            eq(occurrenceTable.occurrenceKey, occurrenceKey),
          ),
        );

      return { expenseId };
    });
  },
};
