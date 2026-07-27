import {
  db,
  expense as expenseTable,
  expenseAuditLog,
  expenseReaction,
  expenseSplit,
  tabParticipant as tabParticipantTable,
  user,
} from "db";
import { eq, ne, desc, sql, or, and, inArray, isNull, not, type SQL } from "drizzle-orm";
import { getParticipantIdForTabUser, ensureMemberParticipantsForTab } from "./tab-participant.js";

export type ExpenseReaction = {
  emoji: string;
  count: number;
  userIds: string[];
};

export type ExpenseFilter = "all" | "involved" | "owed" | "owe";

export type GetExpensesForTabOptions = {
  limit?: number;
  offset?: number;
  filter?: ExpenseFilter;
  userId?: string;
  search?: string;
};

function escapeIlikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export type GetExpensesForTabResult = {
  expenses: Array<{
    id: string;
    tabId: string;
    paidById: string;
    paidByParticipantId: string | null;
    amount: number;
    currency: string;
    originalAmount: number;
    description: string;
    splitType: string;
    expenseDate: Date;
    createdAt: Date;
    deletedAt: Date | null;
    recurringRuleId?: string | null;
    paidBy: { id: string };
    splits: Array<{
      id: string;
      expenseId: string;
      userId: string;
      participantId: string | null;
      amount: number;
      weight: number | null;
      user: { id: string };
    }>;
    reactions: ExpenseReaction[];
  }>;
  total: number;
};

type FlatRow = {
  id: string;
  tabId: string;
  paidById: string | null;
  paidByParticipantId: string | null;
  amount: string;
  currency: string;
  originalAmount: string;
  description: string;
  splitType: string;
  expenseDate: Date;
  createdAt: Date;
  deletedAt: Date | null;
  recurringRuleId: string | null;
  splitId: string | null;
  splitExpenseId: string | null;
  splitUserId: string | null;
  splitParticipantId: string | null;
  splitAmount: string | null;
  splitWeight: string | null;
};

function buildExpensesFromFlatRows(
  rows: FlatRow[],
  reactionsByExpenseId: Map<string, ExpenseReaction[]>,
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
        userId: r.splitUserId ?? r.splitParticipantId ?? "",
        participantId: r.splitParticipantId,
        amount: Number(r.splitAmount),
        weight: r.splitWeight != null ? Number(r.splitWeight) : null,
        user: { id: r.splitUserId ?? r.splitParticipantId ?? "" },
      }));
    return {
      id: first.id,
      tabId: first.tabId,
      paidById: first.paidById ?? "",
      paidByParticipantId: first.paidByParticipantId,
      amount: Number(first.amount),
      currency: first.currency,
      originalAmount: Number(first.originalAmount),
      description: first.description,
      splitType: first.splitType,
      expenseDate: first.expenseDate,
      createdAt: first.createdAt,
      deletedAt: first.deletedAt ?? null,
      recurringRuleId: first.recurringRuleId ?? null,
      paidBy: { id: first.paidById || first.paidByParticipantId || "" },
      splits,
      reactions: reactionsByExpenseId.get(expenseId) ?? [],
    };
  });
}

async function getReactionsForExpenseIds(
  expenseIds: string[],
): Promise<Map<string, ExpenseReaction[]>> {
  if (expenseIds.length === 0) return new Map();
  const rows = await db
    .select({
      expenseId: expenseReaction.expenseId,
      emoji: expenseReaction.emoji,
      userId: expenseReaction.userId,
    })
    .from(expenseReaction)
    .where(inArray(expenseReaction.expenseId, expenseIds));
  const byExpense = new Map<string, Map<string, { count: number; userIds: string[] }>>();
  for (const r of rows) {
    let emojiMap = byExpense.get(r.expenseId);
    if (!emojiMap) {
      emojiMap = new Map();
      byExpense.set(r.expenseId, emojiMap);
    }
    const existing = emojiMap.get(r.emoji);
    if (existing) {
      existing.count += 1;
      existing.userIds.push(r.userId);
    } else {
      emojiMap.set(r.emoji, { count: 1, userIds: [r.userId] });
    }
  }
  const result = new Map<string, ExpenseReaction[]>();
  for (const expenseId of expenseIds) {
    const emojiMap = byExpense.get(expenseId);
    const reactions: ExpenseReaction[] = emojiMap
      ? Array.from(emojiMap.entries()).map(([emoji, { count, userIds }]) => ({
          emoji,
          count,
          userIds,
        }))
      : [];
    result.set(expenseId, reactions);
  }
  return result;
}

export type CreateExpenseInput = {
  tabId: string;
  paidById: string | null;
  paidByParticipantId: string;
  /** Tab-currency total (ledger). */
  amount: number;
  currency: string;
  /** User-entered amount in `currency`. */
  originalAmount: number;
  description: string;
  splitType: string;
  expenseDate: Date;
  splits: {
    participantId: string;
    userId: string | null;
    amount: number;
    weight?: number | null;
  }[];
  performedById: string;
  recurringRuleId?: string | null;
  /** Defaults to `create`. */
  auditAction?: string;
  auditChanges?: Record<string, unknown> | null;
};

export type UpdateExpenseInput = {
  paidById: string | null;
  paidByParticipantId: string;
  amount: number;
  currency: string;
  originalAmount: number;
  description: string;
  splitType: string;
  expenseDate: Date;
  splits: {
    participantId: string;
    userId: string | null;
    amount: number;
    weight?: number | null;
  }[];
  performedById: string;
};

/** Return type of getById. Use string | Date for JSON API responses. */
export type Expense = {
  id: string;
  tabId: string;
  paidById: string | null;
  paidByParticipantId: string | null;
  recurringRuleId?: string | null;
  amount: number;
  currency: string;
  originalAmount: number;
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
    userId: string | null;
    participantId: string | null;
    amount: number;
    weight: number | null;
    user: {
      id: string;
      email: string;
      name: string | null;
      username?: string | null;
    };
  }>;
  reactions: ExpenseReaction[];
};

/** Return type of getAuditLog. Use string | Date for JSON API responses. */
export type ExpenseAuditLogEntry = {
  id: string;
  expenseId: string;
  tabId: string;
  action:
    | "create"
    | "update"
    | "delete"
    | "restore"
    | "create_from_recurring"
    | "placeholder_merge";
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

async function insertExpenseWithClient(
  client: typeof db,
  input: CreateExpenseInput,
): Promise<string> {
  const [inserted] = await client
    .insert(expenseTable)
    .values({
      tabId: input.tabId,
      paidById: input.paidById,
      paidByParticipantId: input.paidByParticipantId,
      recurringRuleId: input.recurringRuleId ?? null,
      amount: input.amount.toString(),
      currency: input.currency,
      originalAmount: input.originalAmount.toString(),
      description: input.description,
      splitType: input.splitType,
      expenseDate: input.expenseDate,
    })
    .returning({ id: expenseTable.id });
  const expenseId = inserted!.id;

  for (const s of input.splits) {
    await client.insert(expenseSplit).values({
      expenseId,
      userId: s.userId,
      participantId: s.participantId,
      amount: s.amount.toString(),
      weight: s.weight != null ? String(s.weight) : null,
    });
  }

  await client.insert(expenseAuditLog).values({
    expenseId,
    tabId: input.tabId,
    action: input.auditAction ?? "create",
    performedById: input.performedById,
    changes: input.auditChanges ?? null,
  });

  return expenseId;
}

export const expense = {
  getById: async (expenseId: string) => {
    const [row] = await db
      .select({
        id: expenseTable.id,
        tabId: expenseTable.tabId,
        paidById: expenseTable.paidById,
        paidByParticipantId: expenseTable.paidByParticipantId,
        recurringRuleId: expenseTable.recurringRuleId,
        amount: expenseTable.amount,
        currency: expenseTable.currency,
        originalAmount: expenseTable.originalAmount,
        description: expenseTable.description,
        splitType: expenseTable.splitType,
        expenseDate: expenseTable.expenseDate,
        createdAt: expenseTable.createdAt,
        deletedAt: expenseTable.deletedAt,
        paidByEmail: user.email,
        paidByName: user.name,
        paidByUsername: user.username,
        payerPartName: tabParticipantTable.displayName,
      })
      .from(expenseTable)
      .leftJoin(user, eq(expenseTable.paidById, user.id))
      .leftJoin(
        tabParticipantTable,
        eq(expenseTable.paidByParticipantId, tabParticipantTable.id),
      )
      .where(eq(expenseTable.id, expenseId))
      .limit(1);

    if (!row) return null;

    const [splits, reactionsByExpenseId] = await Promise.all([
      db
        .select({
          id: expenseSplit.id,
          expenseId: expenseSplit.expenseId,
          userId: expenseSplit.userId,
          participantId: expenseSplit.participantId,
          amount: expenseSplit.amount,
          weight: expenseSplit.weight,
          userEmail: user.email,
          userName: user.name,
          userUsername: user.username,
          partDisplayName: tabParticipantTable.displayName,
        })
        .from(expenseSplit)
        .leftJoin(user, eq(expenseSplit.userId, user.id))
        .leftJoin(
          tabParticipantTable,
          eq(expenseSplit.participantId, tabParticipantTable.id),
        )
        .where(eq(expenseSplit.expenseId, row.id)),
      getReactionsForExpenseIds([row.id]),
    ]);

    const reactions = reactionsByExpenseId.get(row.id) ?? [];

    return {
      ...row,
      recurringRuleId: row.recurringRuleId ?? null,
      amount: Number(row.amount),
      originalAmount: Number(row.originalAmount),
      deletedAt: row.deletedAt ?? null,
      paidBy: {
        id: row.paidById ?? row.paidByParticipantId ?? "",
        email: row.paidByEmail ?? "",
        name: row.paidByName ?? row.payerPartName ?? null,
        username: row.paidByUsername ?? null,
      },
      splits: splits.map((s) => ({
        id: s.id,
        expenseId: s.expenseId,
        userId: s.userId,
        participantId: s.participantId,
        amount: Number(s.amount),
        weight: s.weight != null ? Number(s.weight) : null,
        user: {
          id: s.userId ?? s.participantId ?? "",
          email: s.userEmail ?? "",
          name: s.userName ?? s.partDisplayName ?? null,
          username: s.userUsername ?? null,
        },
      })),
      reactions,
    };
  },

  addOrUpdateReaction: async (
    expenseId: string,
    userId: string,
    emoji: string,
  ): Promise<void> => {
    await db
      .insert(expenseReaction)
      .values({ expenseId, userId, emoji })
      .onConflictDoUpdate({
        target: [expenseReaction.expenseId, expenseReaction.userId],
        set: { emoji },
      });
  },

  removeReaction: async (
    expenseId: string,
    userId: string,
  ): Promise<void> => {
    await db
      .delete(expenseReaction)
      .where(
        and(
          eq(expenseReaction.expenseId, expenseId),
          eq(expenseReaction.userId, userId),
        ),
      );
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
      action: r.action as ExpenseAuditLogEntry["action"],
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
    const filter = options?.filter ?? "all";
    const userId = options?.userId;

    const baseWhere = eq(expenseTable.tabId, tabId);
    let filterWhere = baseWhere;
    if (filter !== "all" && userId) {
      const viewPid = await getParticipantIdForTabUser(tabId, userId);
      const paidByViewer: SQL =
        viewPid != null
          ? or(
              eq(expenseTable.paidById, userId),
              eq(expenseTable.paidByParticipantId, viewPid),
            )!
          : eq(expenseTable.paidById, userId);

      const viewerOnSplit: SQL = sql`exists (
        select 1 from ${expenseSplit} es
        left join ${tabParticipantTable} tp on es."participantId" = tp."id"
        where es."expenseId" = ${expenseTable.id}
        and (es."userId" = ${userId} or tp."userId" = ${userId})
      )`;

      if (filter === "owed") {
        filterWhere = and(baseWhere, paidByViewer)!;
      } else if (filter === "owe") {
        filterWhere = and(baseWhere, not(paidByViewer), viewerOnSplit)!;
      } else if (filter === "involved") {
        const involvedCondition = or(paidByViewer, viewerOnSplit)!;
        filterWhere = and(baseWhere, involvedCondition)!;
      }
    }

    const search = options?.search?.trim();
    if (search) {
      const pattern = `%${escapeIlikePattern(search)}%`;
      filterWhere = and(
        filterWhere,
        sql`${expenseTable.description} ILIKE ${pattern} ESCAPE '\\'`,
      )!;
    }

    const baseExpenseQuery = db
      .select({
        id: expenseTable.id,
        tabId: expenseTable.tabId,
        paidById: expenseTable.paidById,
        paidByParticipantId: expenseTable.paidByParticipantId,
        amount: expenseTable.amount,
        currency: expenseTable.currency,
        originalAmount: expenseTable.originalAmount,
        description: expenseTable.description,
        splitType: expenseTable.splitType,
        expenseDate: expenseTable.expenseDate,
        createdAt: expenseTable.createdAt,
        deletedAt: expenseTable.deletedAt,
        recurringRuleId: expenseTable.recurringRuleId,
      })
      .from(expenseTable)
      .where(filterWhere)
      .orderBy(desc(expenseTable.createdAt));

    const paginated = paginate
      ? baseExpenseQuery.limit(limit).offset(offset).as("paginated")
      : baseExpenseQuery.as("paginated");

    const [countResult, rows] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(expenseTable)
        .where(filterWhere),
      db
        .select({
          id: paginated.id,
          tabId: paginated.tabId,
          paidById: paginated.paidById,
          paidByParticipantId: paginated.paidByParticipantId,
          amount: paginated.amount,
          currency: paginated.currency,
          originalAmount: paginated.originalAmount,
          description: paginated.description,
          splitType: paginated.splitType,
          expenseDate: paginated.expenseDate,
          createdAt: paginated.createdAt,
          deletedAt: paginated.deletedAt,
          recurringRuleId: paginated.recurringRuleId,
          splitId: expenseSplit.id,
          splitExpenseId: expenseSplit.expenseId,
          splitUserId: expenseSplit.userId,
          splitParticipantId: expenseSplit.participantId,
          splitAmount: expenseSplit.amount,
          splitWeight: expenseSplit.weight,
        })
        .from(paginated)
        .leftJoin(expenseSplit, eq(expenseSplit.expenseId, paginated.id))
        .orderBy(desc(paginated.createdAt), expenseSplit.id),
    ]);

    const total = countResult[0]?.count ?? 0;
    const expenseIds = [...new Set((rows as FlatRow[]).map((r) => r.id))];
    const reactionsByExpenseId = await getReactionsForExpenseIds(expenseIds);
    const expenses = buildExpensesFromFlatRows(
      rows as FlatRow[],
      reactionsByExpenseId,
    );

    return { expenses, total };
  },

  create: async (input: CreateExpenseInput): Promise<string> => {
    return insertExpenseWithClient(db, input);
  },

  /**
   * Same as create but uses the given client (e.g. transaction) for inserts.
   */
  insertWithClient: async (
    client: typeof db,
    input: CreateExpenseInput,
  ): Promise<string> => {
    return insertExpenseWithClient(client, input);
  },

  update: async (
    expenseId: string,
    tabId: string,
    input: UpdateExpenseInput,
    existing: {
      amount: string;
      description: string;
      paidById: string | null;
      paidByParticipantId: string | null;
      expenseDate: Date;
      currency: string;
      originalAmount: string;
    },
    existingSplits: {
      userId: string | null;
      participantId: string | null;
      amount: string;
      weight?: string;
    }[],
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
    if (Number(existing.originalAmount) !== input.originalAmount) {
      changes.originalAmount = {
        from: Number(existing.originalAmount),
        to: input.originalAmount,
      };
    }
    const currencyKey = (c: string) => c.trim().toUpperCase();
    if (currencyKey(existing.currency) !== currencyKey(input.currency)) {
      changes.currency = { from: existing.currency, to: input.currency };
    }
    if (existing.description !== input.description) {
      changes.description = { from: existing.description, to: input.description };
    }
    if (existing.paidById !== input.paidById) {
      changes.paidById = { from: existing.paidById, to: input.paidById };
    }
    if (existing.paidByParticipantId !== input.paidByParticipantId) {
      changes.paidByParticipantId = {
        from: existing.paidByParticipantId,
        to: input.paidByParticipantId,
      };
    }
    const roundTo2 = (n: number) => Math.round(n * 100) / 100;
    const oldParticipantIds = [...existingSplits.map((s) => s.participantId ?? s.userId ?? "")].sort();
    const newParticipantIds = [...input.splits.map((s) => s.participantId)].sort();
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
      existingSplits.map((s) => [
        s.participantId ?? s.userId ?? "",
        roundTo2(Number(s.amount)),
      ]),
    );
    const newSplitsMap = Object.fromEntries(
      input.splits.map((s) => [s.participantId, roundTo2(s.amount)]),
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
        paidByParticipantId: input.paidByParticipantId,
        amount: input.amount.toString(),
        currency: input.currency,
        originalAmount: input.originalAmount.toString(),
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
        participantId: s.participantId,
        amount: s.amount.toString(),
        weight: s.weight != null ? String(s.weight) : null,
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
      paidById: string | null;
      paidByParticipantId?: string | null;
      amount: string;
      currency: string;
      originalAmount: string;
      description: string;
      splitType: string;
      expenseDate: Date;
      splits: {
        userId: string | null;
        participantId?: string | null;
        amount: string;
        weight?: string;
      }[];
    }>,
    performedById: string,
  ): Promise<string[]> => {
    const tabIds = [...new Set(items.map((i) => i.tabId))];
    for (const tid of tabIds) {
      await ensureMemberParticipantsForTab(tid);
    }

    const ids: string[] = [];
    await db.transaction(async (tx) => {
      type ResolvedSplit = {
        userId: string | null;
        participantId: string;
        amount: string;
        weight?: string;
      };
      type ResolvedItem = {
        tabId: string;
        paidById: string | null;
        paidByParticipantId: string;
        amount: string;
        currency: string;
        originalAmount: string;
        description: string;
        splitType: string;
        expenseDate: Date;
        splits: ResolvedSplit[];
      };

      const resolved: ResolvedItem[] = [];

      for (const v of items) {
        let paidByPid = v.paidByParticipantId ?? null;
        if (!paidByPid && v.paidById) {
          paidByPid = await getParticipantIdForTabUser(v.tabId, v.paidById);
        }
        if (!paidByPid) {
          throw new Error("createBulk: missing paidByParticipantId / paidById");
        }
        const splits: ResolvedSplit[] = [];
        for (const s of v.splits) {
          let pid = s.participantId ?? null;
          if (!pid && s.userId) {
            pid = await getParticipantIdForTabUser(v.tabId, s.userId);
          }
          if (!pid) {
            throw new Error("createBulk: split missing participantId / userId");
          }
          splits.push({
            userId: s.userId,
            participantId: pid,
            amount: s.amount,
            weight: s.weight,
          });
        }
        resolved.push({
          tabId: v.tabId,
          paidById: v.paidById,
          paidByParticipantId: paidByPid,
          amount: v.amount,
          currency: v.currency,
          originalAmount: v.originalAmount,
          description: v.description,
          splitType: v.splitType,
          expenseDate: v.expenseDate,
          splits,
        });
      }

      const inserted = await tx
        .insert(expenseTable)
        .values(
          resolved.map((v) => ({
            tabId: v.tabId,
            paidById: v.paidById,
            paidByParticipantId: v.paidByParticipantId,
            amount: v.amount,
            currency: v.currency,
            originalAmount: v.originalAmount,
            description: v.description,
            splitType: v.splitType,
            expenseDate: v.expenseDate,
          })),
        )
        .returning({ id: expenseTable.id });

      const splitRows: {
        expenseId: string;
        userId: string | null;
        participantId: string;
        amount: string;
        weight: string | null;
      }[] = [];
      for (let i = 0; i < resolved.length; i++) {
        const expenseId = inserted[i]!.id;
        ids.push(expenseId);
        for (const s of resolved[i]!.splits) {
          splitRows.push({
            expenseId,
            userId: s.userId,
            participantId: s.participantId,
            amount: s.amount,
            weight: s.weight != null ? s.weight : null,
          });
        }
      }
      if (splitRows.length > 0) {
        await tx.insert(expenseSplit).values(splitRows);
      }

      const auditRows = resolved.map((v, i) => ({
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
