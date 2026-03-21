import {
  db,
  expense,
  expenseSplit,
  settlement,
  user,
  tab as tabTable,
  tabMember,
} from "db";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { unionAll } from "drizzle-orm/pg-core";
import { tab } from "./tab.js";

/** Other member in a 1:1 direct tab (for "You split with …" copy). */
export type ActivityDirectOtherUser = {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
};

export type ActivityItem =
  | {
      type: "expense";
      id: string;
      tabId: string;
      tabName: string;
      tabCurrency: string;
      tabIsDirect: boolean;
      directOtherUser: ActivityDirectOtherUser | null;
      paidById: string;
      paidByEmail: string;
      paidByName: string | null;
      paidByUsername: string | null;
      amount: number;
      /** Viewing user's split share; null if they are not on this expense's split. */
      yourShare: number | null;
      description: string;
      expenseDate: Date;
      createdAt: Date;
      deletedAt: Date | null;
    }
  | {
      type: "settlement";
      id: string;
      tabId: string;
      tabName: string;
      tabCurrency: string;
      tabIsDirect: boolean;
      directOtherUser: ActivityDirectOtherUser | null;
      fromUserId: string;
      fromUserEmail: string;
      fromUserName: string | null;
      fromUserUsername: string | null;
      toUserId: string;
      toUserEmail: string;
      toUserName: string | null;
      toUserUsername: string | null;
      amount: number;
      createdAt: Date;
    };

export type GetActivityForUserOptions = {
  limit?: number;
  offset?: number;
};

export type GetActivityForUserResult = {
  items: ActivityItem[];
  total: number;
};

export const activity = {
  getForUser: async (
    userId: string,
    options?: GetActivityForUserOptions | number,
  ): Promise<GetActivityForUserResult | ActivityItem[]> => {
    const limit = typeof options === "number" ? options : options?.limit ?? 50;
    const offset = typeof options === "object" ? (options?.offset ?? 0) : 0;
    const paginate =
      typeof options === "object" &&
      options !== null &&
      options?.limit !== undefined;

    const tabs = await tab.getTabsForUser(userId, { includeDirect: true });
    const tabIds = tabs.map((t) => t.id);

    const tabRows =
      tabIds.length > 0
        ? await db
            .select({
              id: tabTable.id,
              name: tabTable.name,
              currency: tabTable.currency,
              isDirect: tabTable.isDirect,
            })
            .from(tabTable)
            .where(inArray(tabTable.id, tabIds))
        : [];

    const tabMap = Object.fromEntries(
      tabRows.map((t) => [
        t.id,
        { name: t.name, currency: t.currency, isDirect: t.isDirect },
      ]),
    );

    const directTabIds = tabRows.filter((t) => t.isDirect).map((t) => t.id);
    const directOtherByTabId = new Map<string, ActivityDirectOtherUser>();
    if (directTabIds.length > 0) {
      const others = await db
        .select({
          tabId: tabMember.tabId,
          id: user.id,
          email: user.email,
          name: user.name,
          username: user.username,
        })
        .from(tabMember)
        .innerJoin(user, eq(tabMember.userId, user.id))
        .where(
          and(inArray(tabMember.tabId, directTabIds), ne(tabMember.userId, userId)),
        );
      for (const row of others) {
        directOtherByTabId.set(row.tabId, {
          id: row.id,
          email: row.email,
          name: row.name,
          username: row.username,
        });
      }
    }

    if (tabIds.length === 0) {
      return paginate ? { items: [], total: 0 } : [];
    }

    const expenseUnion = db
      .select({
        kind: sql<string>`'expense'`.as("kind"),
        id: expense.id,
        sortAt: sql`${expense.expenseDate}`.as("sortAt"),
      })
      .from(expense)
      .where(inArray(expense.tabId, tabIds));

    const settlementUnion = db
      .select({
        kind: sql<string>`'settlement'`.as("kind"),
        id: settlement.id,
        sortAt: sql`${settlement.createdAt}`.as("sortAt"),
      })
      .from(settlement)
      .where(inArray(settlement.tabId, tabIds));

    const combined = unionAll(expenseUnion, settlementUnion);
    const orderedQuery = combined
      .orderBy(desc(sql`"sortAt"`))
      .limit(limit)
      .offset(offset);

    const [total, orderedRows] = await Promise.all([
      paginate
        ? Promise.all([
            db
              .select({ count: sql<number>`count(*)::int` })
              .from(expense)
              .where(inArray(expense.tabId, tabIds)),
            db
              .select({ count: sql<number>`count(*)::int` })
              .from(settlement)
              .where(inArray(settlement.tabId, tabIds)),
          ]).then(([e, s]) => (e[0]?.count ?? 0) + (s[0]?.count ?? 0))
        : Promise.resolve(0),
      orderedQuery,
    ]);

    const expenseIdsOrdered = orderedRows
      .filter((r) => r.kind === "expense")
      .map((r) => r.id);
    const settlementIdsOrdered = orderedRows
      .filter((r) => r.kind === "settlement")
      .map((r) => r.id);

    const expenses =
      expenseIdsOrdered.length > 0
        ? await db
            .select({
              id: expense.id,
              tabId: expense.tabId,
              paidById: expense.paidById,
              amount: expense.amount,
              description: expense.description,
              expenseDate: expense.expenseDate,
              createdAt: expense.createdAt,
              deletedAt: expense.deletedAt,
              paidByEmail: user.email,
              paidByName: user.name,
              paidByUsername: user.username,
            })
            .from(expense)
            .innerJoin(user, eq(expense.paidById, user.id))
            .where(inArray(expense.id, expenseIdsOrdered))
        : [];

    const settlementRows =
      settlementIdsOrdered.length > 0
        ? await db
            .select()
            .from(settlement)
            .where(inArray(settlement.id, settlementIdsOrdered))
        : [];

    const expenseById = new Map(expenses.map((e) => [e.id, e]));
    const settlementById = new Map(settlementRows.map((s) => [s.id, s]));

    const expenseIds = expenses.map((e) => e.id);
    const viewerShareByExpenseId = new Map<string, number>();
    if (expenseIds.length > 0) {
      const viewerSplits = await db
        .select({
          expenseId: expenseSplit.expenseId,
          amount: expenseSplit.amount,
        })
        .from(expenseSplit)
        .where(
          and(
            inArray(expenseSplit.expenseId, expenseIds),
            eq(expenseSplit.userId, userId),
          ),
        );
      for (const row of viewerSplits) {
        viewerShareByExpenseId.set(row.expenseId, Number(row.amount));
      }
    }

    const userIds = new Set<string>();
    for (const s of settlementRows) {
      userIds.add(s.fromUserId);
      userIds.add(s.toUserId);
    }
    const users =
      userIds.size > 0
        ? await db
            .select({
              id: user.id,
              email: user.email,
              name: user.name,
              username: user.username,
            })
            .from(user)
            .where(inArray(user.id, Array.from(userIds)))
        : [];
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    const items: ActivityItem[] = [];
    for (const row of orderedRows) {
      if (row.kind === "expense") {
        const e = expenseById.get(row.id);
        if (!e) continue;
        const tabInfo = tabMap[e.tabId];
        const isDirect = tabInfo?.isDirect ?? false;
        items.push({
          type: "expense",
          id: e.id,
          tabId: e.tabId,
          tabName: tabInfo?.name ?? "",
          tabCurrency: tabInfo?.currency ?? "USD",
          tabIsDirect: isDirect,
          directOtherUser: isDirect
            ? directOtherByTabId.get(e.tabId) ?? null
            : null,
          paidById: e.paidById,
          paidByEmail: e.paidByEmail,
          paidByName: e.paidByName,
          paidByUsername: e.paidByUsername,
          amount: Number(e.amount),
          yourShare: viewerShareByExpenseId.has(e.id)
            ? viewerShareByExpenseId.get(e.id)!
            : null,
          description: e.description,
          expenseDate: e.expenseDate,
          createdAt: e.createdAt,
          deletedAt: e.deletedAt ?? null,
        });
      } else {
        const s = settlementById.get(row.id);
        if (!s) continue;
        const tabInfo = tabMap[s.tabId];
        const isDirect = tabInfo?.isDirect ?? false;
        items.push({
          type: "settlement",
          id: s.id,
          tabId: s.tabId,
          tabName: tabInfo?.name ?? "",
          tabCurrency: tabInfo?.currency ?? "USD",
          tabIsDirect: isDirect,
          directOtherUser: isDirect
            ? directOtherByTabId.get(s.tabId) ?? null
            : null,
          fromUserId: s.fromUserId,
          fromUserEmail: userMap[s.fromUserId]?.email ?? "",
          fromUserName: userMap[s.fromUserId]?.name ?? null,
          fromUserUsername: userMap[s.fromUserId]?.username ?? null,
          toUserId: s.toUserId,
          toUserEmail: userMap[s.toUserId]?.email ?? "",
          toUserName: userMap[s.toUserId]?.name ?? null,
          toUserUsername: userMap[s.toUserId]?.username ?? null,
          amount: Number(s.amount),
          createdAt: s.createdAt,
        });
      }
    }

    return paginate ? { items, total } : items;
  },
};
