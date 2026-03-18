import { Hono } from "hono";
import type { AuthContext } from "../auth.js";
import { authMiddleware } from "../auth.js";
import { userService } from "services";

export const usernameRoutes = new Hono<{ Variables: { auth: AuthContext } }>();

usernameRoutes.use("*", authMiddleware);

usernameRoutes.get("/check", async (c) => {
  const { userId } = c.get("auth");
  const username = c.req.query("username");

  const result = await userService.checkUsernameAvailable(userId, username ?? "");
  if (!result.success) {
    return c.json({ available: false });
  }
  return c.json({ available: result.data });
});

usernameRoutes.patch("/", async (c) => {
  const { userId } = c.get("auth");
  const body = await c.req.json().catch(() => ({}));
  const raw = body.username;

  if (typeof raw !== "string") {
    return c.json({ success: false, error: "Username is required" }, 400);
  }

  const result = await userService.updateUsername(userId, raw);
  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.status as 400 | 403 | 404);
  }
  return c.json({ success: true });
});
