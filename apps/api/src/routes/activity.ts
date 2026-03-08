import { Hono } from "hono";
import { getActivityForUser } from "data";
import type { AuthContext } from "../auth.js";
import { authMiddleware } from "../auth.js";

export const activityRoutes = new Hono<{ Variables: { auth: AuthContext } }>();

activityRoutes.use("*", authMiddleware);

activityRoutes.get("/", async (c) => {
  const { userId } = c.get("auth");
  const limit = Number(c.req.query("limit")) || 50;
  const items = await getActivityForUser(userId, limit);
  return c.json({ success: true, items });
});
