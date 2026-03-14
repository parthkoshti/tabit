import { Hono } from "hono";
import { db, user } from "db";
import { eq } from "drizzle-orm";
import { CURRENCY_CODES } from "shared";
import type { AuthContext } from "../auth.js";
import { authMiddleware } from "../auth.js";

const NAME_MAX_LENGTH = 64;

export const profileRoutes = new Hono<{ Variables: { auth: AuthContext } }>();

profileRoutes.use("*", authMiddleware);

profileRoutes.patch("/", async (c) => {
  const { userId } = c.get("auth");

  const body = await c.req.json().catch(() => ({}));
  const updates: { name?: string | null; defaultCurrency?: string | null; updatedAt: Date } = {
    updatedAt: new Date(),
  };

  if ("name" in body) {
    const name = typeof body.name === "string" ? body.name.trim() || null : null;
    if (name && name.length > NAME_MAX_LENGTH) {
      return c.json(
        { success: false, error: `Name must be at most ${NAME_MAX_LENGTH} characters` },
        400
      );
    }
    updates.name = name;
  }

  if ("defaultCurrency" in body) {
    const defaultCurrency =
      body.defaultCurrency === null
        ? null
        : typeof body.defaultCurrency === "string"
          ? body.defaultCurrency.trim() || null
          : null;
    if (defaultCurrency !== null && !CURRENCY_CODES.includes(defaultCurrency)) {
      return c.json(
        { success: false, error: "Invalid currency code" },
        400
      );
    }
    updates.defaultCurrency = defaultCurrency;
  }

  await db.update(user).set(updates).where(eq(user.id, userId));

  return c.json({ success: true });
});
