import {
  db,
  tab as tabTable,
  tabMember,
  expense as expenseTable,
  expenseSplit,
  settlement as settlementTable,
  user,
} from "db";
import { eq, desc, inArray, and, sql, isNull } from "drizzle-orm";

export type TabWithBalance = {
  id: string;
  name: string;
  createdAt: Date;
  balance?: number;
  memberUserIds?: string[];
  lastExpenseDate?: Date | null;
  expenseCount?: number;
};

export type FriendTab = {
  id: string;
  createdAt: Date;
  balance: number;
  expenseCount: number;
  lastExpenseDate?: Date | null;
  friend: {
    id: string;
    email: string;
    name: string | null;
    username: string | null;
  };
};

/** Return type of getBalancesForTab. Use string | Date for JSON API responses. */
export type Balance = {
  userId: string;
  amount: number;
  user: {
    id: string;
    email: string;
    name: string | null;
    username?: string | null;
  };
};

/** Return type of getWithMembers. Use string | Date for JSON API responses. */
export type TabWithMembers = {
  id: string;
  name: string;
  createdAt: Date;
  isDirect?: boolean;
  members: Array<{
    userId: string;
    role: string;
    user: { id: string; email: string; name: string | null; username?: string | null };
  }>;
};

async function getBalancesForTab(tabId: string): Promise<Balance[]> {
  const members = await db
    .select({ userId: tabMember.userId })
    .from(tabMember)
    .where(eq(tabMember.tabId, tabId));

  const balances: Record<string, number> = {};
  for (const m of members) {
    balances[m.userId] = 0;
  }

  const expenses = await db
    .select({
      paidById: expenseTable.paidById,
      amount: expenseTable.amount,
    })
    .from(expenseTable)
    .where(and(eq(expenseTable.tabId, tabId), isNull(expenseTable.deletedAt)));

  for (const exp of expenses) {
    balances[exp.paidById] = (balances[exp.paidById] ?? 0) + Number(exp.amount);
  }

  const splits = await db
    .select({
      userId: expenseSplit.userId,
      amount: expenseSplit.amount,
    })
    .from(expenseSplit)
    .innerJoin(expenseTable, eq(expenseSplit.expenseId, expenseTable.id))
    .where(
      and(eq(expenseTable.tabId, tabId), isNull(expenseTable.deletedAt)),
    );

  for (const s of splits) {
    balances[s.userId] = (balances[s.userId] ?? 0) - Number(s.amount);
  }

  const settlements = await db
    .select()
    .from(settlementTable)
    .where(eq(settlementTable.tabId, tabId));

  for (const set of settlements) {
    const amount = Number(set.amount);
    balances[set.fromUserId] = (balances[set.fromUserId] ?? 0) + amount;
    balances[set.toUserId] = (balances[set.toUserId] ?? 0) - amount;
  }

  const userIds = members.map((m) => m.userId);
  const users =
    userIds.length > 0
      ? await db.select().from(user).where(inArray(user.id, userIds))
      : [];

  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  return Object.entries(balances)
    .filter(([, amount]) => Math.abs(amount) > 0.001)
    .map(([userId, amount]) => ({
      userId,
      amount,
      user: {
        id: userId,
        email: userMap[userId]?.email ?? "",
        name: userMap[userId]?.name ?? null,
        username: userMap[userId]?.username ?? null,
      },
    }));
}

export const tab = {
  getBalancesForTab,

  getTabsForUser: async (
    userId: string,
    options?: {
      includeDirect?: boolean;
      includeBalance?: boolean;
      includeMemberIds?: boolean;
      includeLastExpenseDate?: boolean;
      includeExpenseCount?: boolean;
    },
  ): Promise<TabWithBalance[]> => {
    const includeDirect = options?.includeDirect ?? false;
    const includeBalance = options?.includeBalance ?? false;
    const includeMemberIds = options?.includeMemberIds ?? false;
    const includeLastExpenseDate = options?.includeLastExpenseDate ?? false;
    const includeExpenseCount = options?.includeExpenseCount ?? false;

    if (includeDirect) {
      const rows = await db
        .select({
          id: tabTable.id,
          name: tabTable.name,
          createdAt: tabTable.createdAt,
        })
        .from(tabTable)
        .innerJoin(tabMember, eq(tabTable.id, tabMember.tabId))
        .where(eq(tabMember.userId, userId))
        .orderBy(desc(tabTable.createdAt));
      return Promise.all(
        rows.map(async (r) => {
          const result: TabWithBalance = { ...r };
          if (includeBalance) {
            const balances = await getBalancesForTab(r.id);
            const myBalance = balances.find((b) => b.userId === userId);
            result.balance = myBalance ? myBalance.amount : 0;
          }
          if (includeMemberIds) {
            const members = await db
              .select({ userId: tabMember.userId })
              .from(tabMember)
              .where(eq(tabMember.tabId, r.id));
            result.memberUserIds = members.map((m) => m.userId);
          }
          if (includeLastExpenseDate) {
            const [latestExp] = await db
              .select({ expenseDate: expenseTable.expenseDate })
              .from(expenseTable)
              .where(
                and(eq(expenseTable.tabId, r.id), isNull(expenseTable.deletedAt)),
              )
              .orderBy(desc(expenseTable.expenseDate))
              .limit(1);
            const [latestSet] = await db
              .select({ createdAt: settlementTable.createdAt })
              .from(settlementTable)
              .where(eq(settlementTable.tabId, r.id))
              .orderBy(desc(settlementTable.createdAt))
              .limit(1);
            const expDate = latestExp?.expenseDate
              ? new Date(latestExp.expenseDate).getTime()
              : 0;
            const setDate = latestSet?.createdAt
              ? new Date(latestSet.createdAt).getTime()
              : 0;
            result.lastExpenseDate =
              expDate || setDate
                ? new Date(Math.max(expDate, setDate))
                : null;
          }
          if (includeExpenseCount) {
            const [countRow] = await db
              .select({ count: sql<number>`count(*)::int` })
              .from(expenseTable)
              .where(
                and(eq(expenseTable.tabId, r.id), isNull(expenseTable.deletedAt)),
              );
            result.expenseCount = countRow?.count ?? 0;
          }
          return result;
        }),
      );
    }

    const isDirectFalse = sql`${tabTable.isDirect} = false`;
    const rows = await db
      .select({
        id: tabTable.id,
        name: tabTable.name,
        createdAt: tabTable.createdAt,
      })
      .from(tabTable)
      .innerJoin(tabMember, eq(tabTable.id, tabMember.tabId))
      .where(and(eq(tabMember.userId, userId), isDirectFalse))
      .orderBy(desc(tabTable.createdAt));

    return Promise.all(
      rows.map(async (r) => {
        const result: TabWithBalance = { ...r };
        if (includeBalance) {
          const balances = await getBalancesForTab(r.id);
          const myBalance = balances.find((b) => b.userId === userId);
          result.balance = myBalance ? myBalance.amount : 0;
        }
        if (includeMemberIds) {
          const members = await db
            .select({ userId: tabMember.userId })
            .from(tabMember)
            .where(eq(tabMember.tabId, r.id));
          result.memberUserIds = members.map((m) => m.userId);
        }
        if (includeLastExpenseDate) {
          const [latestExp] = await db
            .select({ expenseDate: expenseTable.expenseDate })
            .from(expenseTable)
            .where(
              and(eq(expenseTable.tabId, r.id), isNull(expenseTable.deletedAt)),
            )
            .orderBy(desc(expenseTable.expenseDate))
            .limit(1);
          const [latestSet] = await db
            .select({ createdAt: settlementTable.createdAt })
            .from(settlementTable)
            .where(eq(settlementTable.tabId, r.id))
            .orderBy(desc(settlementTable.createdAt))
            .limit(1);
          const expDate = latestExp?.expenseDate
            ? new Date(latestExp.expenseDate).getTime()
            : 0;
          const setDate = latestSet?.createdAt
            ? new Date(latestSet.createdAt).getTime()
            : 0;
          result.lastExpenseDate =
            expDate || setDate ? new Date(Math.max(expDate, setDate)) : null;
        }
        if (includeExpenseCount) {
          const [countRow] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(expenseTable)
            .where(
              and(eq(expenseTable.tabId, r.id), isNull(expenseTable.deletedAt)),
            );
          result.expenseCount = countRow?.count ?? 0;
        }
        return result;
      }),
    );
  },

  getDirectTabsForUser: async (userId: string): Promise<FriendTab[]> => {
    const isDirectTrue = sql`${tabTable.isDirect} = true`;
    const directTabs = await db
      .select({
        id: tabTable.id,
        createdAt: tabTable.createdAt,
      })
      .from(tabTable)
      .innerJoin(tabMember, eq(tabTable.id, tabMember.tabId))
      .where(and(isDirectTrue, eq(tabMember.userId, userId)))
      .orderBy(desc(tabTable.createdAt));

    const result: FriendTab[] = [];
    for (const t of directTabs) {
      const members = await db
        .select({
          userId: tabMember.userId,
          email: user.email,
          name: user.name,
          username: user.username,
        })
        .from(tabMember)
        .innerJoin(user, eq(tabMember.userId, user.id))
        .where(eq(tabMember.tabId, t.id));

      const other = members.find((m) => m.userId !== userId);
      if (other) {
        const balances = await getBalancesForTab(t.id);
        const myBalance = balances.find((b) => b.userId === userId);
        const deletedAtNull = isNull(expenseTable.deletedAt);
        const [countRow] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(expenseTable)
          .where(and(eq(expenseTable.tabId, t.id), deletedAtNull));
        const [latestExp] = await db
          .select({ expenseDate: expenseTable.expenseDate })
          .from(expenseTable)
          .where(and(eq(expenseTable.tabId, t.id), deletedAtNull))
          .orderBy(desc(expenseTable.expenseDate))
          .limit(1);
        const [latestSet] = await db
          .select({ createdAt: settlementTable.createdAt })
          .from(settlementTable)
          .where(eq(settlementTable.tabId, t.id))
          .orderBy(desc(settlementTable.createdAt))
          .limit(1);
        const expDate = latestExp?.expenseDate
          ? new Date(latestExp.expenseDate).getTime()
          : 0;
        const setDate = latestSet?.createdAt
          ? new Date(latestSet.createdAt).getTime()
          : 0;
        const lastExpenseDate =
          expDate || setDate ? new Date(Math.max(expDate, setDate)) : null;
        result.push({
          id: t.id,
          createdAt: t.createdAt,
          balance: myBalance ? myBalance.amount : 0,
          expenseCount: countRow?.count ?? 0,
          lastExpenseDate,
          friend: {
            id: other.userId,
            email: other.email,
            name: other.name,
            username: other.username,
          },
        });
      }
    }

    return result;
  },

  getWithMembers: async (tabId: string) => {
    const [t] = await db
      .select()
      .from(tabTable)
      .where(eq(tabTable.id, tabId))
      .limit(1);

    if (!t) return null;

    const members = await db
      .select({
        userId: tabMember.userId,
        role: tabMember.role,
        email: user.email,
        name: user.name,
        username: user.username,
      })
      .from(tabMember)
      .innerJoin(user, eq(tabMember.userId, user.id))
      .where(eq(tabMember.tabId, tabId));

    return {
      ...t,
      members: members.map((m) => ({
        userId: m.userId,
        role: m.role,
        user: { id: m.userId, email: m.email, name: m.name, username: m.username },
      })),
    };
  },

  create: async (name: string, userId: string): Promise<string> => {
    const [inserted] = await db
      .insert(tabTable)
      .values({ name })
      .returning({ id: tabTable.id });
    const id = inserted!.id;
    await db.insert(tabMember).values({
      tabId: id,
      userId,
      role: "owner",
    });
    return id;
  },

  update: async (tabId: string, name: string): Promise<void> => {
    await db.update(tabTable).set({ name }).where(eq(tabTable.id, tabId));
  },

  addMember: async (
    tabId: string,
    targetUserId: string,
    role: string,
  ): Promise<void> => {
    await db.insert(tabMember).values({
      tabId,
      userId: targetUserId,
      role,
    });
  },

  removeMember: async (tabId: string, targetUserId: string): Promise<void> => {
    await db
      .delete(tabMember)
      .where(
        and(eq(tabMember.tabId, tabId), eq(tabMember.userId, targetUserId)),
      );
  },

  createDirect: async (userId1: string, userId2: string): Promise<string> => {
    const [inserted] = await db
      .insert(tabTable)
      .values({ name: "Direct", isDirect: true })
      .returning({ id: tabTable.id });
    const id = inserted!.id;
    await db.insert(tabMember).values([
      { tabId: id, userId: userId1, role: "member" },
      { tabId: id, userId: userId2, role: "member" },
    ]);
    return id;
  },
};
