import { Hono } from "hono";
import { activity } from "data";
import type { AuthContext } from "../auth.js";
import { authMiddleware } from "../auth.js";

export const activityRoutes = new Hono<{ Variables: { auth: AuthContext } }>();

activityRoutes.use("*", authMiddleware);

activityRoutes.get("/", async (c) => {
  const { userId } = c.get("auth");
  const limit = Number(c.req.query("limit")) || 50;
  const offset = Number(c.req.query("offset")) || 0;
  const result = await activity.getForUser(userId, { limit, offset });
  const items = typeof result === "object" && "items" in result ? result.items : result;
  const total = typeof result === "object" && "total" in result ? result.total : items.length;
  return c.json({ success: true, items, total });
});
