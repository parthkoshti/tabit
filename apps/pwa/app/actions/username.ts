"use server";

import { auth } from "@/lib/auth";
import { db, user } from "db";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";

const USERNAME_REGEX = /^[a-zA-Z0-9_]{5,12}$/;

function validateUsername(value: string): { ok: true; data: string } | { ok: false; error: string } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: false, error: "Username is required" };
  if (trimmed.length < 5) return { ok: false, error: "Username must be at least 5 characters" };
  if (trimmed.length > 12) return { ok: false, error: "Username must be at most 12 characters" };
  if (!USERNAME_REGEX.test(trimmed)) return { ok: false, error: "Username can only contain letters, numbers, and underscores" };
  return { ok: true, data: trimmed.toLowerCase() };
}

export async function checkUsernameAvailability(username: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { available: false };
  }

  const result = validateUsername(username);
  if (!result.ok) return { available: false };
  const normalized = result.data;
  const currentUsername = (session.user as { username?: string })?.username?.toLowerCase();

  if (normalized === currentUsername) {
    return { available: true };
  }

  const [existing] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.username, normalized))
    .limit(1);

  return { available: !existing };
}

export async function updateUsername(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  const raw = formData.get("username");
  if (typeof raw !== "string") {
    return { success: false, error: "Username is required" };
  }

  const parsed = validateUsername(raw);
  if (!parsed.ok) {
    return { success: false, error: parsed.error };
  }

  const username = parsed.data;

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
    .set({ username, updatedAt: new Date() })
    .where(eq(user.id, session.user.id));

  return { success: true };
}
