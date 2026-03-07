"use server";

import { db, tab, tabMember, user } from "db";
import { createTabSchema, addMemberSchema, updateTabSchema } from "models";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";

export async function createTab(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = createTabSchema.safeParse({
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().formErrors[0] };
  }

  const [inserted] = await db
    .insert(tab)
    .values({ name: parsed.data.name })
    .returning({ id: tab.id });
  const id = inserted!.id;
  await db.insert(tabMember).values({
    tabId: id,
    userId: session.user.id,
    role: "owner",
  });

  return { success: true, tabId: id };
}

export async function updateTab(tabId: string, formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = updateTabSchema.safeParse({
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().formErrors[0] };
  }

  const [currentUserMember] = await db
    .select()
    .from(tabMember)
    .where(
      and(
        eq(tabMember.tabId, tabId),
        eq(tabMember.userId, session.user.id)
      )
    )
    .limit(1);

  if (!currentUserMember || currentUserMember.role !== "owner") {
    return { success: false, error: "Only the tab admin can rename the tab" };
  }

  const [existingTab] = await db
    .select()
    .from(tab)
    .where(eq(tab.id, tabId))
    .limit(1);

  if (!existingTab) {
    return { success: false, error: "Tab not found" };
  }

  if (existingTab.isDirect) {
    return { success: false, error: "Direct tabs cannot be renamed" };
  }

  await db
    .update(tab)
    .set({ name: parsed.data.name })
    .where(eq(tab.id, tabId));

  return { success: true };
}

export async function addMember(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = addMemberSchema.safeParse({
    tabId: formData.get("tabId"),
    email: formData.get("email"),
    role: formData.get("role") ?? "member",
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().formErrors[0] };
  }

  const [targetUser] = await db
    .select()
    .from(user)
    .where(eq(user.email, parsed.data.email))
    .limit(1);

  if (!targetUser) {
    return { success: false, error: "User not found with that email" };
  }

  const [existing] = await db
    .select()
    .from(tabMember)
    .where(
      and(
        eq(tabMember.tabId, parsed.data.tabId),
        eq(tabMember.userId, targetUser.id)
      )
    )
    .limit(1);

  if (existing) {
    return { success: false, error: "User is already a member" };
  }

  await db.insert(tabMember).values({
    tabId: parsed.data.tabId,
    userId: targetUser.id,
    role: parsed.data.role,
  });

  return { success: true };
}

export async function leaveTab(tabId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  await db
    .delete(tabMember)
    .where(
      and(
        eq(tabMember.tabId, tabId),
        eq(tabMember.userId, session.user.id)
      )
    );

  return { success: true };
}

export async function removeMember(tabId: string, userId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  if (userId === session.user.id) {
    return { success: false, error: "Use leave to remove yourself" };
  }

  const [currentUserMember] = await db
    .select()
    .from(tabMember)
    .where(
      and(
        eq(tabMember.tabId, tabId),
        eq(tabMember.userId, session.user.id)
      )
    )
    .limit(1);

  if (!currentUserMember || currentUserMember.role !== "owner") {
    return { success: false, error: "Only the tab admin can remove members" };
  }

  const [targetMember] = await db
    .select()
    .from(tabMember)
    .where(
      and(
        eq(tabMember.tabId, tabId),
        eq(tabMember.userId, userId)
      )
    )
    .limit(1);

  if (!targetMember) {
    return { success: false, error: "User is not a member of this tab" };
  }

  await db
    .delete(tabMember)
    .where(
      and(
        eq(tabMember.tabId, tabId),
        eq(tabMember.userId, userId)
      )
    );

  return { success: true };
}
