"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  getTabsForUser,
  getTabWithMembers,
  getExpensesForTab,
  getExpenseById,
  getExpenseAuditLog,
  getSettlementsForTab,
  getBalancesForTab,
  getActivityForUser,
  getDirectTabsForUser,
} from "@/lib/data";
import { db, tabMember } from "db";
import { eq, and } from "drizzle-orm";

export async function fetchTabs() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  return getTabsForUser(session.user.id, {
    includeBalance: true,
    includeMemberIds: true,
  });
}

export async function fetchTab(tabId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const tab = await getTabWithMembers(tabId);
  if (!tab) return null;
  const isMember = tab.members.some((m) => m.userId === session.user.id);
  if (!isMember) return null;
  return tab;
}

export async function fetchExpenses(tabId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  return getExpensesForTab(tabId);
}

export async function fetchExpense(expenseId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const exp = await getExpenseById(expenseId);
  if (!exp) return null;
  const [member] = await db
    .select()
    .from(tabMember)
    .where(
      and(
        eq(tabMember.tabId, exp.tabId),
        eq(tabMember.userId, session.user.id)
      )
    )
    .limit(1);
  if (!member) return null;
  return exp;
}

export async function fetchExpenseAuditLog(expenseId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const exp = await getExpenseById(expenseId);
  if (!exp) return null;
  const [member] = await db
    .select()
    .from(tabMember)
    .where(
      and(
        eq(tabMember.tabId, exp.tabId),
        eq(tabMember.userId, session.user.id)
      )
    )
    .limit(1);
  if (!member) return null;
  return getExpenseAuditLog(expenseId);
}

export async function fetchSettlements(tabId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  return getSettlementsForTab(tabId);
}

export async function fetchBalances(tabId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  return getBalancesForTab(tabId);
}

export async function fetchActivity() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  return getActivityForUser(session.user.id);
}

export async function fetchFriends() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  return getDirectTabsForUser(session.user.id);
}
