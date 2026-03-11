import { db, expense, settlement, user } from "db";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { tab } from "./tab.js";

export type ActivityItem =
  | {
      type: "expense";
      id: string;
      tabId: string;
      tabName: string;
      paidById: string;
      paidByEmail: string;
      paidByName: string | null;
      paidByUsername: string | null;
      amount: number;
      description: string;
      expenseDate: Date;
      createdAt: Date;
    }
  | {
      type: "settlement";
      id: string;
      tabId: string;
      tabName: string;
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
    const tabMap = Object.fromEntries(tabs.map((t) => [t.id, t.name]));

    if (tabIds.length === 0) {
      return paginate ? { items: [], total: 0 } : [];
    }

    const fetchSize = paginate ? limit + offset : limit;

    const [countResult, expenses, settlementRows] = await Promise.all([
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
        : 0,
      db
        .select({
          id: expense.id,
          tabId: expense.tabId,
          paidById: expense.paidById,
          amount: expense.amount,
          description: expense.description,
          expenseDate: expense.expenseDate,
          createdAt: expense.createdAt,
          paidByEmail: user.email,
          paidByName: user.name,
          paidByUsername: user.username,
        })
        .from(expense)
        .innerJoin(user, eq(expense.paidById, user.id))
        .where(inArray(expense.tabId, tabIds))
        .orderBy(desc(expense.expenseDate))
        .limit(fetchSize),
      db
        .select()
        .from(settlement)
        .where(inArray(settlement.tabId, tabIds))
        .orderBy(desc(settlement.createdAt))
        .limit(fetchSize),
    ]);

    const total = typeof countResult === "number" ? countResult : 0;

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

    const items: ActivityItem[] = [
      ...expenses.map((e) => ({
        type: "expense" as const,
        id: e.id,
        tabId: e.tabId,
        tabName: tabMap[e.tabId] ?? "",
        paidById: e.paidById,
        paidByEmail: e.paidByEmail,
        paidByName: e.paidByName,
        paidByUsername: e.paidByUsername,
        amount: Number(e.amount),
        description: e.description,
        expenseDate: e.expenseDate,
        createdAt: e.createdAt,
      })),
      ...settlementRows.map((s) => ({
        type: "settlement" as const,
        id: s.id,
        tabId: s.tabId,
        tabName: tabMap[s.tabId] ?? "",
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
      })),
    ];

    items.sort((a, b) => {
      const dateA = a.type === "expense" ? a.expenseDate : a.createdAt;
      const dateB = b.type === "expense" ? b.expenseDate : b.createdAt;
      return dateB.getTime() - dateA.getTime();
    });

    const sliced = paginate ? items.slice(offset, offset + limit) : items;

    return paginate ? { items: sliced, total } : sliced;
  },
};
