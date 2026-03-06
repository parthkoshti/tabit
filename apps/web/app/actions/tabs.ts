"use server";

import { db, tab, tabMember, user } from "db";
import { createTabSchema, addMemberSchema } from "models";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

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

  const id = nanoid();
  await db.insert(tab).values({
    id,
    name: parsed.data.name,
  });
  await db.insert(tabMember).values({
    tabId: id,
    userId: session.user.id,
    role: "owner",
  });

  return { success: true, tabId: id };
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
