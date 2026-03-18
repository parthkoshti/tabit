import { Hono } from "hono";
import { isAddExpensePreference } from "models";
import type { AuthContext } from "../auth.js";
import { authMiddleware } from "../auth.js";
import { userService } from "services";

export const preferencesRoutes = new Hono<{ Variables: { auth: AuthContext } }>();

preferencesRoutes.use("*", authMiddleware);

preferencesRoutes.get("/", async (c) => {
  const { userId } = c.get("auth");
  const result = await userService.getPreferences(userId);
  return c.json({ success: true, ...result.data });
});

preferencesRoutes.patch("/", async (c) => {
  const { userId } = c.get("auth");
  const body = await c.req.json().catch(() => ({}));

  const updates: { addExpensePreference?: "ai" | "manual" | null } = {};
  if ("addExpensePreference" in body) {
    const val = body.addExpensePreference;
    updates.addExpensePreference =
      val === null || val === undefined
        ? null
        : isAddExpensePreference(val)
          ? val
          : null;
  }

  if (Object.keys(updates).length === 0) {
    return c.json({ success: true });
  }

  await userService.updatePreferences(userId, updates);
  return c.json({ success: true });
});
