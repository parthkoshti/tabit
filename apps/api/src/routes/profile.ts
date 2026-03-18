import { Hono } from "hono";
import type { AuthContext } from "../auth.js";
import { authMiddleware } from "../auth.js";
import { userService } from "services";

export const profileRoutes = new Hono<{ Variables: { auth: AuthContext } }>();

profileRoutes.use("*", authMiddleware);

profileRoutes.patch("/", async (c) => {
  const { userId } = c.get("auth");
  const body = await c.req.json().catch(() => ({}));

  const updates: { name?: string | null; defaultCurrency?: string | null } = {};
  if ("name" in body) {
    updates.name =
      body.name === null || body.name === undefined
        ? null
        : typeof body.name === "string"
          ? body.name.trim() || null
          : null;
  }
  if ("defaultCurrency" in body) {
    updates.defaultCurrency =
      body.defaultCurrency === null || body.defaultCurrency === undefined
        ? null
        : typeof body.defaultCurrency === "string"
          ? body.defaultCurrency.trim() || null
          : null;
  }

  const result = await userService.updateProfile(userId, updates);
  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.status as 400 | 403 | 404);
  }
  return c.json({ success: true });
});
