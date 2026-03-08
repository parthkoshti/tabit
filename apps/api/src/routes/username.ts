import { Hono } from "hono";
import { db, user } from "db";
import { eq } from "drizzle-orm";
import type { AuthContext } from "../auth.js";
import { authMiddleware } from "../auth.js";

const USERNAME_REGEX = /^[a-zA-Z0-9_]{5,12}$/;

function validateUsername(
  value: string
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

export const usernameRoutes = new Hono<{ Variables: { auth: AuthContext } }>();

usernameRoutes.use("*", authMiddleware);

usernameRoutes.get("/check", async (c) => {
  const { userId } = c.get("auth");
  const username = c.req.query("username");

  const result = validateUsername(username ?? "");
  if (!result.ok) return c.json({ available: false });

  const normalized = result.data;
  const [currentUser] = await db
    .select({ username: user.username })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  const currentUsername = currentUser?.username?.toLowerCase();
  if (normalized === currentUsername) {
    return c.json({ available: true });
  }

  const [existing] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.username, normalized))
    .limit(1);

  return c.json({ available: !existing });
});

usernameRoutes.patch("/", async (c) => {
  const { userId } = c.get("auth");

  const body = await c.req.json().catch(() => ({}));
  const raw = body.username;

  if (typeof raw !== "string") {
    return c.json({ success: false, error: "Username is required" }, 400);
  }

  const parsed = validateUsername(raw);
  if (!parsed.ok) {
    return c.json({ success: false, error: parsed.error }, 400);
  }

  const username = parsed.data;

  const [existing] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.username, username))
    .limit(1);

  if (existing && existing.id !== userId) {
    return c.json({ success: false, error: "Username is already taken" }, 400);
  }

  await db
    .update(user)
    .set({ username, updatedAt: new Date() })
    .where(eq(user.id, userId));

  return c.json({ success: true });
});
