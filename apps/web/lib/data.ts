import {
  db,
  group,
  groupMember,
  expense,
  expenseSplit,
  settlement,
  user,
} from "db";
import { eq, desc, inArray } from "drizzle-orm";

export async function getGroupsForUser(userId: string) {
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
    })
    .from(groupMember)
    .innerJoin(user, eq(groupMember.userId, user.id))
    .where(eq(groupMember.groupId, groupId));

  return {
    ...g,
    members: members.map((m) => ({
      userId: m.userId,
      role: m.role,
      user: { id: m.userId, email: m.email, name: m.name },
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
      },
      splits: splits.map((s) => ({
        id: s.id,
        expenseId: s.expenseId,
        userId: s.userId,
        amount: Number(s.amount),
        user: { id: s.userId, email: s.userEmail, name: s.userName },
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
      },
    }));
}
