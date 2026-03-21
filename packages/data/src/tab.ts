import {
  db,
  tab as tabTable,
  tabMember,
  expense as expenseTable,
  expenseSplit,
  settlement as settlementTable,
  user,
} from "db";
import { eq, desc, inArray, and, sql, isNull, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

export type TabWithBalance = {
  id: string;
  name: string;
  currency: string;
  createdAt: Date;
  balance?: number;
  memberUserIds?: string[];
  lastExpenseDate?: Date | null;
  expenseCount?: number;
};

export type FriendTab = {
  id: string;
  currency: string;
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

/** Non-direct tabs where both users are members (for “shared group tabs” UI). */
export type SharedGroupTabListItem = {
  id: string;
  name: string;
  currency: string;
  createdAt: Date;
  memberUserIds: string[];
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
  currency: string;
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
          currency: tabTable.currency,
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
        currency: tabTable.currency,
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
        currency: tabTable.currency,
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
          currency: t.currency,
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

  create: async (
    name: string,
    userId: string,
    currency: string = "USD",
  ): Promise<string> => {
    const [inserted] = await db
      .insert(tabTable)
      .values({ name, currency })
      .returning({ id: tabTable.id });
    const id = inserted!.id;
    await db.insert(tabMember).values({
      tabId: id,
      userId,
      role: "owner",
    });
    return id;
  },

  update: async (
    tabId: string,
    updates: { name?: string; currency?: string },
  ): Promise<void> => {
    const set: Record<string, unknown> = {};
    if (updates.name !== undefined) set.name = updates.name;
    if (updates.currency !== undefined) set.currency = updates.currency;
    if (Object.keys(set).length === 0) return;
    await db.update(tabTable).set(set).where(eq(tabTable.id, tabId));
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

  isMember: async (tabId: string, userId: string): Promise<boolean> => {
    const [member] = await db
      .select({ userId: tabMember.userId })
      .from(tabMember)
      .where(and(eq(tabMember.tabId, tabId), eq(tabMember.userId, userId)))
      .limit(1);
    return !!member;
  },

  getMembers: async (
    tabId: string,
  ): Promise<Array<{ userId: string; role: string }>> => {
    const rows = await db
      .select({ userId: tabMember.userId, role: tabMember.role })
      .from(tabMember)
      .where(eq(tabMember.tabId, tabId));
    return rows;
  },

  getCurrency: async (tabId: string): Promise<string | null> => {
    const [row] = await db
      .select({ currency: tabTable.currency })
      .from(tabTable)
      .where(eq(tabTable.id, tabId))
      .limit(1);
    return row?.currency ?? null;
  },

  getTabInfoForNotifications: async (
    tabId: string,
    forUserId: string,
  ): Promise<{
    name: string;
    isDirect: boolean;
    currency: string;
    displayName: string;
  } | null> => {
    const [tabRow] = await db
      .select({
        name: tabTable.name,
        isDirect: tabTable.isDirect,
        currency: tabTable.currency,
      })
      .from(tabTable)
      .where(eq(tabTable.id, tabId))
      .limit(1);
    if (!tabRow) return null;
    let displayName = tabRow.name ?? "Tab";
    if (tabRow.isDirect) {
      const [otherUser] = await db
        .select({ name: user.name, username: user.username })
        .from(tabMember)
        .innerJoin(user, eq(tabMember.userId, user.id))
        .where(
          and(
            eq(tabMember.tabId, tabId),
            ne(tabMember.userId, forUserId),
          ),
        )
        .limit(1);
      if (otherUser) {
        displayName =
          otherUser.name ??
          (otherUser.username ? `@${otherUser.username}` : null) ??
          displayName;
      }
    }
    return {
      name: tabRow.name ?? "Tab",
      isDirect: tabRow.isDirect ?? false,
      currency: tabRow.currency ?? "USD",
      displayName,
    };
  },

  listGroupTabsSharedBetweenUsers: async (
    userId1: string,
    userId2: string,
  ): Promise<SharedGroupTabListItem[]> => {
    const tabMemberB = alias(tabMember, "tab_member_b");
    const rows = await db
      .select({
        id: tabTable.id,
        name: tabTable.name,
        currency: tabTable.currency,
        createdAt: tabTable.createdAt,
      })
      .from(tabTable)
      .innerJoin(
        tabMember,
        and(eq(tabTable.id, tabMember.tabId), eq(tabMember.userId, userId1)),
      )
      .innerJoin(
        tabMemberB,
        and(eq(tabTable.id, tabMemberB.tabId), eq(tabMemberB.userId, userId2)),
      )
      .where(eq(tabTable.isDirect, false))
      .orderBy(desc(tabTable.createdAt));

    if (rows.length === 0) return [];

    const tabIds = rows.map((r) => r.id);
    const memberRows = await db
      .select({ tabId: tabMember.tabId, userId: tabMember.userId })
      .from(tabMember)
      .where(inArray(tabMember.tabId, tabIds));

    const byTab = new Map<string, string[]>();
    for (const m of memberRows) {
      const list = byTab.get(m.tabId) ?? [];
      list.push(m.userId);
      byTab.set(m.tabId, list);
    }

    return rows.map((r) => ({
      ...r,
      memberUserIds: byTab.get(r.id) ?? [],
    }));
  },

  createDirect: async (
    userId1: string,
    userId2: string,
    currency: string = "USD",
  ): Promise<string> => {
    const user1DirectTabs = await db
      .select({ tabId: tabMember.tabId })
      .from(tabTable)
      .innerJoin(tabMember, eq(tabTable.id, tabMember.tabId))
      .where(
        and(eq(tabTable.isDirect, true), eq(tabMember.userId, userId1)),
      );
    const tabIds = user1DirectTabs.map((d) => d.tabId);
    if (tabIds.length > 0) {
      const [existing] = await db
        .select({ tabId: tabMember.tabId })
        .from(tabMember)
        .where(
          and(
            inArray(tabMember.tabId, tabIds),
            eq(tabMember.userId, userId2),
          ),
        )
        .limit(1);
      if (existing) return existing.tabId;
    }
    const [inserted] = await db
      .insert(tabTable)
      .values({ name: "Direct", isDirect: true, currency })
      .returning({ id: tabTable.id });
    const id = inserted!.id;
    await db.insert(tabMember).values([
      { tabId: id, userId: userId1, role: "member" },
      { tabId: id, userId: userId2, role: "member" },
    ]);
    return id;
  },
};
