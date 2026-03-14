import {
  db,
  expense as expenseTable,
  expenseAuditLog,
  expenseSplit,
  user,
} from "db";
import { eq, desc, sql } from "drizzle-orm";

export type GetExpensesForTabOptions = {
  limit?: number;
  offset?: number;
};

export type GetExpensesForTabResult = {
  expenses: Array<{
    id: string;
    tabId: string;
    paidById: string;
    amount: number;
    description: string;
    splitType: string;
    expenseDate: Date;
    createdAt: Date;
    deletedAt: Date | null;
    paidBy: { id: string };
    splits: Array<{
      id: string;
      expenseId: string;
      userId: string;
      amount: number;
      user: { id: string };
    }>;
  }>;
  total: number;
};

type FlatRow = {
  id: string;
  tabId: string;
  paidById: string;
  amount: string;
  description: string;
  splitType: string;
  expenseDate: Date;
  createdAt: Date;
  deletedAt: Date | null;
  splitId: string | null;
  splitExpenseId: string | null;
  splitUserId: string | null;
  splitAmount: string | null;
};

function buildExpensesFromFlatRows(
  rows: FlatRow[],
): GetExpensesForTabResult["expenses"] {
  const byExpenseId = new Map<string, FlatRow[]>();
  for (const row of rows) {
    const list = byExpenseId.get(row.id) ?? [];
    list.push(row);
    byExpenseId.set(row.id, list);
  }
  return Array.from(byExpenseId.entries()).map(([expenseId, expenseRows]) => {
    const first = expenseRows[0]!;
    const splits = expenseRows
      .filter((r) => r.splitId != null)
      .map((r) => ({
        id: r.splitId!,
        expenseId: r.splitExpenseId!,
        userId: r.splitUserId!,
        amount: Number(r.splitAmount),
        user: { id: r.splitUserId! },
      }));
    return {
      id: first.id,
      tabId: first.tabId,
      paidById: first.paidById,
      amount: Number(first.amount),
      description: first.description,
      splitType: first.splitType,
      expenseDate: first.expenseDate,
      createdAt: first.createdAt,
      deletedAt: first.deletedAt ?? null,
      paidBy: { id: first.paidById },
      splits,
    };
  });
}

export type CreateExpenseInput = {
  tabId: string;
  paidById: string;
  amount: number;
  description: string;
  splitType: string;
  expenseDate: Date;
  splits: { userId: string; amount: number }[];
  performedById: string;
};

export type UpdateExpenseInput = {
  paidById: string;
  amount: number;
  description: string;
  splitType: string;
  expenseDate: Date;
  splits: { userId: string; amount: number }[];
  performedById: string;
};

/** Return type of getById. Use string | Date for JSON API responses. */
export type Expense = {
  id: string;
  tabId: string;
  paidById: string;
  amount: number;
  description: string;
  splitType: string;
  expenseDate: Date;
  createdAt: Date;
  deletedAt: Date | null;
  paidBy: {
    id: string;
    email: string;
    name: string | null;
    username?: string | null;
  };
  splits: Array<{
    id: string;
    expenseId: string;
    userId: string;
    amount: number;
    user: {
      id: string;
      email: string;
      name: string | null;
      username?: string | null;
    };
  }>;
};

/** Return type of getAuditLog. Use string | Date for JSON API responses. */
export type ExpenseAuditLogEntry = {
  id: string;
  expenseId: string;
  tabId: string;
  action: "create" | "update" | "delete" | "restore";
  performedById: string;
  performedAt: Date;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  performedBy: {
    id: string;
    email: string;
    name: string | null;
    username?: string | null;
  };
};

export const expense = {
  getById: async (expenseId: string) => {
    const [row] = await db
      .select({
        id: expenseTable.id,
        tabId: expenseTable.tabId,
        paidById: expenseTable.paidById,
        amount: expenseTable.amount,
        description: expenseTable.description,
        splitType: expenseTable.splitType,
        expenseDate: expenseTable.expenseDate,
        createdAt: expenseTable.createdAt,
        deletedAt: expenseTable.deletedAt,
        paidByEmail: user.email,
        paidByName: user.name,
        paidByUsername: user.username,
      })
      .from(expenseTable)
      .innerJoin(user, eq(expenseTable.paidById, user.id))
      .where(eq(expenseTable.id, expenseId))
      .limit(1);

    if (!row) return null;

    const splits = await db
      .select({
        id: expenseSplit.id,
        expenseId: expenseSplit.expenseId,
        userId: expenseSplit.userId,
        amount: expenseSplit.amount,
        userEmail: user.email,
        userName: user.name,
        userUsername: user.username,
      })
      .from(expenseSplit)
      .innerJoin(user, eq(expenseSplit.userId, user.id))
      .where(eq(expenseSplit.expenseId, row.id));

    return {
      ...row,
      amount: Number(row.amount),
      deletedAt: row.deletedAt ?? null,
      paidBy: {
        id: row.paidById,
        email: row.paidByEmail,
        name: row.paidByName,
        username: row.paidByUsername,
      },
      splits: splits.map((s) => ({
        id: s.id,
        expenseId: s.expenseId,
        userId: s.userId,
        amount: Number(s.amount),
        user: {
          id: s.userId,
          email: s.userEmail,
          name: s.userName,
          username: s.userUsername,
        },
      })),
    };
  },

  getAuditLog: async (expenseId: string) => {
    const rows = await db
      .select({
        id: expenseAuditLog.id,
        expenseId: expenseAuditLog.expenseId,
        tabId: expenseAuditLog.tabId,
        action: expenseAuditLog.action,
        performedById: expenseAuditLog.performedById,
        performedAt: expenseAuditLog.performedAt,
        changes: expenseAuditLog.changes,
        performedByEmail: user.email,
        performedByName: user.name,
        performedByUsername: user.username,
      })
      .from(expenseAuditLog)
      .innerJoin(user, eq(expenseAuditLog.performedById, user.id))
      .where(eq(expenseAuditLog.expenseId, expenseId))
      .orderBy(desc(expenseAuditLog.performedAt));

    return rows.map((r) => ({
      id: r.id,
      expenseId: r.expenseId,
      tabId: r.tabId,
      action: r.action as "create" | "update" | "delete" | "restore",
      performedById: r.performedById,
      performedAt: r.performedAt,
      changes: r.changes as Record<string, { from: unknown; to: unknown }> | null,
      performedBy: {
        id: r.performedById,
        email: r.performedByEmail,
        name: r.performedByName,
        username: r.performedByUsername,
      },
    }));
  },

  getForTab: async (
    tabId: string,
    options?: GetExpensesForTabOptions,
  ): Promise<GetExpensesForTabResult> => {
    const limit = options?.limit;
    const offset = options?.offset ?? 0;
    const paginate = limit !== undefined;

    const baseExpenseQuery = db
      .select({
        id: expenseTable.id,
        tabId: expenseTable.tabId,
        paidById: expenseTable.paidById,
        amount: expenseTable.amount,
        description: expenseTable.description,
        splitType: expenseTable.splitType,
        expenseDate: expenseTable.expenseDate,
        createdAt: expenseTable.createdAt,
        deletedAt: expenseTable.deletedAt,
      })
      .from(expenseTable)
      .where(eq(expenseTable.tabId, tabId))
      .orderBy(desc(expenseTable.expenseDate));

    const paginated = paginate
      ? baseExpenseQuery.limit(limit).offset(offset).as("paginated")
      : baseExpenseQuery.as("paginated");

    const [countResult, rows] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(expenseTable)
        .where(eq(expenseTable.tabId, tabId)),
      db
        .select({
          id: paginated.id,
          tabId: paginated.tabId,
          paidById: paginated.paidById,
          amount: paginated.amount,
          description: paginated.description,
          splitType: paginated.splitType,
          expenseDate: paginated.expenseDate,
          createdAt: paginated.createdAt,
          deletedAt: paginated.deletedAt,
          splitId: expenseSplit.id,
          splitExpenseId: expenseSplit.expenseId,
          splitUserId: expenseSplit.userId,
          splitAmount: expenseSplit.amount,
        })
        .from(paginated)
        .leftJoin(expenseSplit, eq(expenseSplit.expenseId, paginated.id))
        .orderBy(desc(paginated.expenseDate), expenseSplit.id),
    ]);

    const total = countResult[0]?.count ?? 0;
    const expenses = buildExpensesFromFlatRows(rows as FlatRow[]);

    return { expenses, total };
  },

  create: async (input: CreateExpenseInput): Promise<string> => {
    const [inserted] = await db
      .insert(expenseTable)
      .values({
        tabId: input.tabId,
        paidById: input.paidById,
        amount: input.amount.toString(),
        description: input.description,
        splitType: input.splitType,
        expenseDate: input.expenseDate,
      })
      .returning({ id: expenseTable.id });
    const expenseId = inserted!.id;

    for (const s of input.splits) {
      await db.insert(expenseSplit).values({
        expenseId,
        userId: s.userId,
        amount: s.amount.toString(),
      });
    }

    await db.insert(expenseAuditLog).values({
      expenseId,
      tabId: input.tabId,
      action: "create",
      performedById: input.performedById,
      changes: null,
    });

    return expenseId;
  },

  update: async (
    expenseId: string,
    tabId: string,
    input: UpdateExpenseInput,
    existing: { amount: string; description: string; paidById: string; expenseDate: Date },
    existingSplits: { userId: string; amount: string }[],
  ): Promise<void> => {
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    const existingDateStr = new Date(existing.expenseDate).toISOString().slice(0, 10);
    const newDateStr = input.expenseDate.toISOString().slice(0, 10);
    if (existingDateStr !== newDateStr) {
      changes.expenseDate = { from: existing.expenseDate, to: input.expenseDate };
    }
    if (Number(existing.amount) !== input.amount) {
      changes.amount = { from: Number(existing.amount), to: input.amount };
    }
    if (existing.description !== input.description) {
      changes.description = { from: existing.description, to: input.description };
    }
    if (existing.paidById !== input.paidById) {
      changes.paidById = { from: existing.paidById, to: input.paidById };
    }
    const roundTo2 = (n: number) => Math.round(n * 100) / 100;
    const oldParticipantIds = [...existingSplits.map((s) => s.userId)].sort();
    const newParticipantIds = [...input.splits.map((s) => s.userId)].sort();
    if (
      oldParticipantIds.length !== newParticipantIds.length ||
      oldParticipantIds.some((id, i) => id !== newParticipantIds[i])
    ) {
      changes.participants = {
        from: oldParticipantIds,
        to: newParticipantIds,
      };
    }
    const oldSplitsMap = Object.fromEntries(
      existingSplits.map((s) => [s.userId, roundTo2(Number(s.amount))]),
    );
    const newSplitsMap = Object.fromEntries(
      input.splits.map((s) => [s.userId, roundTo2(s.amount)]),
    );
    const splitsChanged =
      JSON.stringify(oldSplitsMap) !== JSON.stringify(newSplitsMap);
    if (splitsChanged && !changes.participants) {
      changes.splits = { from: oldSplitsMap, to: newSplitsMap };
    }

    await db
      .update(expenseTable)
      .set({
        paidById: input.paidById,
        amount: input.amount.toString(),
        description: input.description,
        splitType: input.splitType,
        expenseDate: input.expenseDate,
      })
      .where(eq(expenseTable.id, expenseId));

    await db.delete(expenseSplit).where(eq(expenseSplit.expenseId, expenseId));

    for (const s of input.splits) {
      await db.insert(expenseSplit).values({
        expenseId,
        userId: s.userId,
        amount: s.amount.toString(),
      });
    }

    if (Object.keys(changes).length > 0) {
      await db.insert(expenseAuditLog).values({
        expenseId,
        tabId,
        action: "update",
        performedById: input.performedById,
        changes: changes as unknown as Record<string, unknown>,
      });
    }
  },

  delete: async (
    expenseId: string,
    tabId: string,
    performedById: string,
  ): Promise<void> => {
    await db.insert(expenseAuditLog).values({
      expenseId,
      tabId,
      action: "delete",
      performedById,
      changes: null,
    });

    await db
      .update(expenseTable)
      .set({ deletedAt: new Date() })
      .where(eq(expenseTable.id, expenseId));
  },

  restore: async (
    expenseId: string,
    tabId: string,
    performedById: string,
  ): Promise<void> => {
    await db
      .update(expenseTable)
      .set({ deletedAt: null })
      .where(eq(expenseTable.id, expenseId));

    await db.insert(expenseAuditLog).values({
      expenseId,
      tabId,
      action: "restore",
      performedById,
      changes: null,
    });
  },

  createBulk: async (
    items: Array<{
      tabId: string;
      paidById: string;
      amount: string;
      description: string;
      splitType: string;
      expenseDate: Date;
      splits: { userId: string; amount: string }[];
    }>,
    performedById: string,
  ): Promise<string[]> => {
    const ids: string[] = [];
    await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(expenseTable)
        .values(
          items.map((v) => ({
            tabId: v.tabId,
            paidById: v.paidById,
            amount: v.amount,
            description: v.description,
            splitType: v.splitType,
            expenseDate: v.expenseDate,
          })),
        )
        .returning({ id: expenseTable.id });

      const splitRows: { expenseId: string; userId: string; amount: string }[] = [];
      for (let i = 0; i < items.length; i++) {
        const expenseId = inserted[i]!.id;
        ids.push(expenseId);
        for (const s of items[i]!.splits) {
          splitRows.push({ expenseId, userId: s.userId, amount: s.amount });
        }
      }
      if (splitRows.length > 0) {
        await tx.insert(expenseSplit).values(splitRows);
      }

      const auditRows = items.map((v, i) => ({
        expenseId: inserted[i]!.id,
        tabId: v.tabId,
        action: "create" as const,
        performedById,
        changes: null,
      }));
      await tx.insert(expenseAuditLog).values(auditRows);
    });
    return ids;
  },
};
