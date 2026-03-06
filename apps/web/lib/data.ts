import "server-only";
import {
  db,
  group,
  groupMember,
  expense,
  expenseSplit,
  settlement,
  user,
} from "db";
import { eq, desc, inArray, and, sql } from "drizzle-orm";

export async function getGroupsForUser(
  userId: string,
  options?: { includeDirect?: boolean }
) {
  const includeDirect = options?.includeDirect ?? false;

  if (includeDirect) {
    const rows = await db
      .select({
        id: group.id,
        name: group.name,
        createdAt: group.createdAt,
      })
      .from(group)
      .innerJoin(groupMember, eq(group.id, groupMember.groupId))
      .where(eq(groupMember.userId, userId))
      .orderBy(desc(group.createdAt));
    return rows;
  }

  const isDirectFalse = sql`${group.isDirect} = false`;
  const rows = await db
    .select({
      id: group.id,
      name: group.name,
      createdAt: group.createdAt,
    })
    .from(group)
    .innerJoin(groupMember, eq(group.id, groupMember.groupId))
    .where(and(eq(groupMember.userId, userId), isDirectFalse))
    .orderBy(desc(group.createdAt));

  return rows;
}

export type FriendGroup = {
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

export async function getDirectGroupsForUser(userId: string): Promise<FriendGroup[]> {
  const isDirectTrue = sql`${group.isDirect} = true`;
  const directGroups = await db
    .select({
      id: group.id,
      createdAt: group.createdAt,
    })
    .from(group)
    .innerJoin(groupMember, eq(group.id, groupMember.groupId))
    .where(and(isDirectTrue, eq(groupMember.userId, userId)))
    .orderBy(desc(group.createdAt));

  const result: FriendGroup[] = [];
  for (const g of directGroups) {
    const members = await db
      .select({
        userId: groupMember.userId,
        email: user.email,
        name: user.name,
        username: user.username,
      })
      .from(groupMember)
      .innerJoin(user, eq(groupMember.userId, user.id))
      .where(eq(groupMember.groupId, g.id));

    const other = members.find((m) => m.userId !== userId);
    if (other) {
      const balances = await getBalancesForGroup(g.id);
      const myBalance = balances.find((b) => b.userId === userId);
      result.push({
        id: g.id,
        createdAt: g.createdAt,
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

export async function getGroupWithMembers(groupId: string) {
  const [g] = await db
    .select()
    .from(group)
    .where(eq(group.id, groupId))
    .limit(1);

  if (!g) return null;

  const members = await db
    .select({
      userId: groupMember.userId,
      role: groupMember.role,
      email: user.email,
      name: user.name,
      username: user.username,
    })
    .from(groupMember)
    .innerJoin(user, eq(groupMember.userId, user.id))
    .where(eq(groupMember.groupId, groupId));

  return {
    ...g,
    members: members.map((m) => ({
      userId: m.userId,
      role: m.role,
      user: { id: m.userId, email: m.email, name: m.name, username: m.username },
    })),
  };
}

export async function getExpensesForGroup(groupId: string) {
  const rows = await db
    .select({
      id: expense.id,
      groupId: expense.groupId,
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
    .where(eq(expense.groupId, groupId))
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

export async function getBalancesForGroup(groupId: string) {
  const members = await db
    .select({ userId: groupMember.userId })
    .from(groupMember)
    .where(eq(groupMember.groupId, groupId));

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
    .where(eq(expense.groupId, groupId));

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
    .where(eq(expense.groupId, groupId));

  for (const s of splits) {
    balances[s.userId] = (balances[s.userId] ?? 0) - Number(s.amount);
  }

  const settlements = await db
    .select()
    .from(settlement)
    .where(eq(settlement.groupId, groupId));

  for (const set of settlements) {
    balances[set.fromUserId] =
      (balances[set.fromUserId] ?? 0) - Number(set.amount);
    balances[set.toUserId] = (balances[set.toUserId] ?? 0) + Number(set.amount);
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
      groupId: string;
      groupName: string;
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
      groupId: string;
      groupName: string;
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
  const groups = await getGroupsForUser(userId, { includeDirect: true });
  const groupIds = groups.map((g) => g.id);
  const groupMap = Object.fromEntries(groups.map((g) => [g.id, g.name]));

  if (groupIds.length === 0) return [];

  const expenses = await db
    .select({
      id: expense.id,
      groupId: expense.groupId,
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
    .where(inArray(expense.groupId, groupIds))
    .orderBy(desc(expense.createdAt))
    .limit(limit);

  const settlementRows = await db
    .select()
    .from(settlement)
    .where(inArray(settlement.groupId, groupIds))
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
      groupId: e.groupId,
      groupName: groupMap[e.groupId] ?? "",
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
      groupId: s.groupId,
      groupName: groupMap[s.groupId] ?? "",
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
