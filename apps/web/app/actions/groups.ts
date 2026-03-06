"use server";

import { db, group, groupMember, user } from "db";
import { createGroupSchema, addMemberSchema } from "models";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

export async function createGroup(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = createGroupSchema.safeParse({
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().formErrors[0] };
  }

  const id = nanoid();
  await db.insert(group).values({
    id,
    name: parsed.data.name,
  });
  await db.insert(groupMember).values({
    groupId: id,
    userId: session.user.id,
    role: "owner",
  });

  return { success: true, groupId: id };
}

export async function addMember(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = addMemberSchema.safeParse({
    groupId: formData.get("groupId"),
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
    .from(groupMember)
    .where(
      and(
        eq(groupMember.groupId, parsed.data.groupId),
        eq(groupMember.userId, targetUser.id)
      )
    )
    .limit(1);

  if (existing) {
    return { success: false, error: "User is already a member" };
  }

  await db.insert(groupMember).values({
    groupId: parsed.data.groupId,
    userId: targetUser.id,
    role: parsed.data.role,
  });

  return { success: true };
}

export async function leaveGroup(groupId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  await db
    .delete(groupMember)
    .where(
      and(
        eq(groupMember.groupId, groupId),
        eq(groupMember.userId, session.user.id)
      )
    );

  return { success: true };
}
