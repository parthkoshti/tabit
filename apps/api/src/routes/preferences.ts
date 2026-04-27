import { Hono } from "hono";
import { isAddExpensePreference } from "models";
import type { AuthContext } from "../auth.js";
import { authMiddleware } from "../auth.js";
import { resolveSuggestedTimezoneForRequest } from "../lib/request-timezone-suggestion.js";
import { userService } from "services";

export const preferencesRoutes = new Hono<{ Variables: { auth: AuthContext } }>();

preferencesRoutes.use("*", authMiddleware);

preferencesRoutes.get("/", async (c) => {
  const { userId } = c.get("auth");
  const result = await userService.getPreferences(userId);
  const suggestedTimezoneFromRequest = await resolveSuggestedTimezoneForRequest(
    c.req.raw.headers,
  );
  return c.json({
    success: true,
    ...result.data,
    suggestedTimezoneFromRequest,
  });
});

preferencesRoutes.patch("/", async (c) => {
  const { userId } = c.get("auth");
  const body = await c.req.json().catch(() => ({}));

  const updates: {
    addExpensePreference?: "ai" | "manual" | null;
    timezone?: string | null;
  } = {};
  if ("addExpensePreference" in body) {
    const val = body.addExpensePreference;
    updates.addExpensePreference =
      val === null || val === undefined
        ? null
        : isAddExpensePreference(val)
          ? val
          : null;
  }
  if ("timezone" in body) {
    const tz = body.timezone;
    updates.timezone =
      tz === null || tz === undefined
        ? null
        : typeof tz === "string"
          ? tz.trim() || null
          : null;
  }

  if (Object.keys(updates).length === 0) {
    return c.json({ success: true });
  }

  if ("timezone" in updates) {
    const tzResult = await userService.updateProfile(userId, {
      timezone: updates.timezone,
    });
    if (!tzResult.success) {
      return c.json({ success: false, error: tzResult.error }, tzResult.status as 400);
    }
    delete updates.timezone;
  }

  if (Object.keys(updates).length > 0) {
    await userService.updatePreferences(userId, updates);
  }
  return c.json({ success: true });
});
