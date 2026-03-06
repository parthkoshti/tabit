"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  getTabsForUser,
  getTabWithMembers,
  getExpensesForTab,
  getSettlementsForTab,
  getBalancesForTab,
  getActivityForUser,
  getDirectTabsForUser,
} from "@/lib/data";

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
