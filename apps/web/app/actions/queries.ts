"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  getGroupsForUser,
  getGroupWithMembers,
  getExpensesForGroup,
  getBalancesForGroup,
} from "@/lib/data";

export async function fetchGroups() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  return getGroupsForUser(session.user.id);
}

export async function fetchGroup(groupId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const group = await getGroupWithMembers(groupId);
  if (!group) return null;
  const isMember = group.members.some((m) => m.userId === session.user.id);
  if (!isMember) return null;
  return group;
}

export async function fetchExpenses(groupId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  return getExpensesForGroup(groupId);
}

export async function fetchBalances(groupId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  return getBalancesForGroup(groupId);
}
