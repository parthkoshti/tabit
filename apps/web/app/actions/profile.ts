"use server";

import { auth } from "@/lib/auth";
import { db, user } from "db";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";

const NAME_MAX_LENGTH = 64;

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
