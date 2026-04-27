import { Hono } from "hono";
import type { AuthContext } from "../auth.js";
import { authMiddleware } from "../auth.js";
import { recurringExpenseService } from "services";

/** Tab-agnostic CRUD by rule id (for PWA `/expense/recurring/:id`). */
export const recurringExpensesRootRoutes = new Hono<{ Variables: { auth: AuthContext } }>();

recurringExpensesRootRoutes.use("*", authMiddleware);

recurringExpensesRootRoutes.get("/:ruleId", async (c) => {
  const { userId } = c.get("auth");
  const ruleId = c.req.param("ruleId")!;
  const result = await recurringExpenseService.getById(ruleId, userId);
  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.status as 400 | 403 | 404);
  }
  return c.json({ success: true, rule: result.data });
});

recurringExpensesRootRoutes.patch("/:ruleId", async (c) => {
  const { userId } = c.get("auth");
  const ruleId = c.req.param("ruleId")!;
  const body = await c.req.json().catch(() => ({}));
  const result = await recurringExpenseService.update(ruleId, userId, body);
  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.status as 400 | 403 | 404);
  }
  return c.json({ success: true });
});

recurringExpensesRootRoutes.delete("/:ruleId", async (c) => {
  const { userId } = c.get("auth");
  const ruleId = c.req.param("ruleId")!;
  const result = await recurringExpenseService.deleteRule(ruleId, userId);
  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.status as 400 | 403 | 404);
  }
  return c.json({ success: true });
});
