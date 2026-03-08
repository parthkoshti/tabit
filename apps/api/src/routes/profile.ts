import { Hono } from "hono";
import { db, user } from "db";
import { eq } from "drizzle-orm";
import type { AuthContext } from "../auth.js";
import { authMiddleware } from "../auth.js";

const NAME_MAX_LENGTH = 64;

export const profileRoutes = new Hono<{ Variables: { auth: AuthContext } }>();

profileRoutes.use("*", authMiddleware);

profileRoutes.patch("/", async (c) => {
  const { userId } = c.get("auth");

  const body = await c.req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() || null : null;

  if (name && name.length > NAME_MAX_LENGTH) {
    return c.json(
      { success: false, error: `Name must be at most ${NAME_MAX_LENGTH} characters` },
      400
    );
  }

  await db
    .update(user)
    .set({ name: name ?? null, updatedAt: new Date() })
    .where(eq(user.id, userId));

  return c.json({ success: true });
});
