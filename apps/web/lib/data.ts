import "server-only";
import {
  db,
  tab,
  tabMember,
  expense,
  expenseSplit,
  settlement,
  user,
} from "db";
import { eq, desc, inArray, and, sql } from "drizzle-orm";

export type TabWithBalance = {
  id: string;
  name: string;
  createdAt: Date;
  balance?: number;
  memberUserIds?: string[];
};

export async function getTabsForUser(
  userId: string,
  options?: {
    includeDirect?: boolean;
    includeBalance?: boolean;
    includeMemberIds?: boolean;
  }
): Promise<TabWithBalance[]> {
  const includeDirect = options?.includeDirect ?? false;
  const includeBalance = options?.includeBalance ?? false;
  const includeMemberIds = options?.includeMemberIds ?? false;

  if (includeDirect) {
    const rows = await db
      .select({
        id: tab.id,
        name: tab.name,
        createdAt: tab.createdAt,
      })
      .from(tab)
      .innerJoin(tabMember, eq(tab.id, tabMember.tabId))
      .where(eq(tabMember.userId, userId))
      .orderBy(desc(tab.createdAt));
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
        return result;
      })
    );
  }

  const isDirectFalse = sql`${tab.isDirect} = false`;
  const rows = await db
    .select({
      id: tab.id,
      name: tab.name,
      createdAt: tab.createdAt,
    })
    .from(tab)
    .innerJoin(tabMember, eq(tab.id, tabMember.tabId))
    .where(and(eq(tabMember.userId, userId), isDirectFalse))
    .orderBy(desc(tab.createdAt));

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
      return result;
    })
  );
}

export type FriendTab = {
  id: string;
  createdAt: Date;
  balance: number;
  friend: {
    id: string;
    email: string;
    name: string | null;
    username: string | null;
  };
};

export { getDisplayName } from "./display-name";

export async function getDirectTabsForUser(userId: string): Promise<FriendTab[]> {
  const isDirectTrue = sql`${tab.isDirect} = true`;
  const directTabs = await db
    .select({
      id: tab.id,
      createdAt: tab.createdAt,
    })
    .from(tab)
    .innerJoin(tabMember, eq(tab.id, tabMember.tabId))
    .where(and(isDirectTrue, eq(tabMember.userId, userId)))
    .orderBy(desc(tab.createdAt));

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
      result.push({
        id: t.id,
        createdAt: t.createdAt,
        balance: myBalance ? myBalance.amount : 0,
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
}

export async function getTabWithMembers(tabId: string) {
  const [t] = await db
    .select()
    .from(tab)
    .where(eq(tab.id, tabId))
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
}

export async function getExpensesForTab(tabId: string) {
  const rows = await db
    .select({
      id: expense.id,
      tabId: expense.tabId,
      paidById: expense.paidById,
      amount: expense.amount,
      description: expense.description,
      splitType: expense.splitType,
      createdAt: expense.createdAt,
      paidByEmail: user.email,
      paidByName: user.name,
      paidByUsername: user.username,
    })
    .from(expense)
    .innerJoin(user, eq(expense.paidById, user.id))
    .where(eq(expense.tabId, tabId))
    .orderBy(desc(expense.createdAt));

  const result = [];
  for (const row of rows) {
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

    result.push({
      ...row,
      amount: Number(row.amount),
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
    });
  }

  return result;
}

export async function getSettlementsForTab(tabId: string) {
  const rows = await db
    .select({
      id: settlement.id,
      tabId: settlement.tabId,
      fromUserId: settlement.fromUserId,
      toUserId: settlement.toUserId,
      amount: settlement.amount,
      createdAt: settlement.createdAt,
      fromUserEmail: user.email,
      fromUserName: user.name,
      fromUserUsername: user.username,
    })
    .from(settlement)
    .innerJoin(user, eq(settlement.fromUserId, user.id))
    .where(eq(settlement.tabId, tabId))
    .orderBy(desc(settlement.createdAt));

  const toUserIds = [...new Set(rows.map((r) => r.toUserId))];
  const toUsers =
    toUserIds.length > 0
      ? await db
          .select({
            id: user.id,
            email: user.email,
            name: user.name,
            username: user.username,
          })
          .from(user)
          .where(inArray(user.id, toUserIds))
      : [];
  const toUserMap = Object.fromEntries(toUsers.map((u) => [u.id, u]));

  return rows.map((r) => ({
    id: r.id,
    tabId: r.tabId,
    fromUserId: r.fromUserId,
    toUserId: r.toUserId,
    amount: Number(r.amount),
    createdAt: r.createdAt,
    fromUser: {
      id: r.fromUserId,
      email: r.fromUserEmail,
      name: r.fromUserName,
      username: r.fromUserUsername,
    },
    toUser: toUserMap[r.toUserId]
      ? {
          id: toUserMap[r.toUserId].id,
          email: toUserMap[r.toUserId].email,
          name: toUserMap[r.toUserId].name,
          username: toUserMap[r.toUserId].username,
        }
      : {
          id: r.toUserId,
          email: "",
          name: null,
          username: null,
        },
  }));
}

export async function getBalancesForTab(tabId: string) {
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
      paidById: expense.paidById,
      amount: expense.amount,
    })
    .from(expense)
    .where(eq(expense.tabId, tabId));

  for (const exp of expenses) {
    balances[exp.paidById] = (balances[exp.paidById] ?? 0) + Number(exp.amount);
  }

  const splits = await db
    .select({
      userId: expenseSplit.userId,
      amount: expenseSplit.amount,
    })
    .from(expenseSplit)
    .innerJoin(expense, eq(expenseSplit.expenseId, expense.id))
    .where(eq(expense.tabId, tabId));

  for (const s of splits) {
    balances[s.userId] = (balances[s.userId] ?? 0) - Number(s.amount);
  }

  const settlements = await db
    .select()
    .from(settlement)
    .where(eq(settlement.tabId, tabId));

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

export async function getActivityForUser(userId: string, limit = 50) {
  const tabs = await getTabsForUser(userId, { includeDirect: true });
  const tabIds = tabs.map((t) => t.id);
  const tabMap = Object.fromEntries(tabs.map((t) => [t.id, t.name]));

  if (tabIds.length === 0) return [];

  const expenses = await db
    .select({
      id: expense.id,
      tabId: expense.tabId,
      paidById: expense.paidById,
      amount: expense.amount,
      description: expense.description,
      createdAt: expense.createdAt,
      paidByEmail: user.email,
      paidByName: user.name,
      paidByUsername: user.username,
    })
    .from(expense)
    .innerJoin(user, eq(expense.paidById, user.id))
    .where(inArray(expense.tabId, tabIds))
    .orderBy(desc(expense.createdAt))
    .limit(limit);

  const settlementRows = await db
    .select()
    .from(settlement)
    .where(inArray(settlement.tabId, tabIds))
    .orderBy(desc(settlement.createdAt))
    .limit(limit);

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

  items.sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
  return items.slice(0, limit);
}
