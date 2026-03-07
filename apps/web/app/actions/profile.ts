"use server";

import { auth } from "@/lib/auth";
import { db, user } from "db";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";

const NAME_MAX_LENGTH = 64;
const USERNAME_REGEX = /^[a-zA-Z0-9_]{5,12}$/;

function validateUsername(
  value: string,
): { ok: true; data: string } | { ok: false; error: string } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: false, error: "Username is required" };
  if (trimmed.length < 5)
    return { ok: false, error: "Username must be at least 5 characters" };
  if (trimmed.length > 12)
    return { ok: false, error: "Username must be at most 12 characters" };
  if (!USERNAME_REGEX.test(trimmed))
    return {
      ok: false,
      error: "Username can only contain letters, numbers, and underscores",
    };
  return { ok: true, data: trimmed.toLowerCase() };
}

export async function completeProfile(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  const nameRaw = formData.get("name");
  const name = typeof nameRaw === "string" ? nameRaw.trim() : "";
  if (!name) {
    return { success: false, error: "Name is required" };
  }
  if (name.length > NAME_MAX_LENGTH) {
    return {
      success: false,
      error: `Name must be at most ${NAME_MAX_LENGTH} characters`,
    };
  }

  const usernameRaw = formData.get("username");
  if (typeof usernameRaw !== "string") {
    return { success: false, error: "Username is required" };
  }
  const usernameResult = validateUsername(usernameRaw);
  if (!usernameResult.ok) {
    return { success: false, error: usernameResult.error };
  }
  const username = usernameResult.data;

  const [existing] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.username, username))
    .limit(1);

  if (existing && existing.id !== session.user.id) {
    return { success: false, error: "Username is already taken" };
  }

  await db
    .update(user)
    .set({
      name,
      username,
      updatedAt: new Date(),
    })
    .where(eq(user.id, session.user.id));

  return { success: true };
}

export async function updateName(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  const raw = formData.get("name");
  const name = typeof raw === "string" ? raw.trim() || null : null;

  if (name && name.length > NAME_MAX_LENGTH) {
    return { success: false, error: `Name must be at most ${NAME_MAX_LENGTH} characters` };
  }

  await db
    .update(user)
    .set({ name: name || null, updatedAt: new Date() })
    .where(eq(user.id, session.user.id));

  return { success: true };
}
