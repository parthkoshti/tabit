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
  getSettlementById,
  getSettlementAuditLog,
  getBalancesForTab,
  getActivityForUser,
  getDirectTabsForUser,
  type GetExpensesForTabResult,
  type GetActivityForUserResult,
} from "@/lib/data";
import { db, tabMember } from "db";
import { eq, and } from "drizzle-orm";

export async function fetchTabs() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  return getTabsForUser(session.user.id, {
    includeDirect: false,
    includeBalance: true,
    includeMemberIds: true,
    includeLastExpenseDate: true,
    includeExpenseCount: true,
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

export async function fetchExpenses(
  tabId: string,
  options?: { limit?: number; offset?: number },
): Promise<GetExpensesForTabResult | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  return getExpensesForTab(tabId, options);
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
        eq(tabMember.userId, session.user.id),
      ),
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
        eq(tabMember.userId, session.user.id),
      ),
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

export async function fetchSettlement(settlementId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const s = await getSettlementById(settlementId);
  if (!s) return null;
  const [member] = await db
    .select()
    .from(tabMember)
    .where(
      and(
        eq(tabMember.tabId, s.tabId),
        eq(tabMember.userId, session.user.id),
      ),
    )
    .limit(1);
  if (!member) return null;
  return s;
}

export async function fetchSettlementAuditLog(settlementId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const s = await getSettlementById(settlementId);
  if (!s) return null;
  const [member] = await db
    .select()
    .from(tabMember)
    .where(
      and(
        eq(tabMember.tabId, s.tabId),
        eq(tabMember.userId, session.user.id),
      ),
    )
    .limit(1);
  if (!member) return null;
  return getSettlementAuditLog(settlementId);
}

export async function fetchBalances(tabId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  return getBalancesForTab(tabId);
}

export async function fetchActivity(options?: {
  limit?: number;
  offset?: number;
}): Promise<GetActivityForUserResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { items: [], total: 0 };
  const result = await getActivityForUser(session.user.id, options);
  return typeof result === "object" && result !== null && "items" in result
    ? result
    : { items: Array.isArray(result) ? result : [], total: Array.isArray(result) ? result.length : 0 };
}

export async function fetchFriends() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  return getDirectTabsForUser(session.user.id);
}
