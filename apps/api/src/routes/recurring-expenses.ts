import { Hono } from "hono";
import type { AuthContext } from "../auth.js";
import { authMiddleware } from "../auth.js";
import { recurringExpenseService } from "services";

export const recurringExpensesRoutes = new Hono<{ Variables: { auth: AuthContext } }>();

recurringExpensesRoutes.use("*", authMiddleware);

recurringExpensesRoutes.get("/", async (c) => {
  const { userId } = c.get("auth");
  const tabId = c.req.param("tabId")!;
  const result = await recurringExpenseService.listForTab(tabId, userId);
  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.status as 400 | 403);
  }
  return c.json({ success: true, rules: result.data });
});

recurringExpensesRoutes.post("/", async (c) => {
  const { userId } = c.get("auth");
  const tabId = c.req.param("tabId")!;
  const body = await c.req.json().catch(() => ({}));
  const result = await recurringExpenseService.create(tabId, userId, body);
  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.status as 400 | 403);
  }
  return c.json({ success: true, ruleId: result.data.ruleId });
});

recurringExpensesRoutes.get("/:ruleId", async (c) => {
  const { userId } = c.get("auth");
  const ruleId = c.req.param("ruleId")!;
  const result = await recurringExpenseService.getById(ruleId, userId);
  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.status as 400 | 403 | 404);
  }
  return c.json({ success: true, rule: result.data });
});

recurringExpensesRoutes.patch("/:ruleId", async (c) => {
  const { userId } = c.get("auth");
  const ruleId = c.req.param("ruleId")!;
  const body = await c.req.json().catch(() => ({}));
  const result = await recurringExpenseService.update(ruleId, userId, body);
  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.status as 400 | 403 | 404);
  }
  return c.json({ success: true });
});

recurringExpensesRoutes.delete("/:ruleId", async (c) => {
  const { userId } = c.get("auth");
  const ruleId = c.req.param("ruleId")!;
  const result = await recurringExpenseService.deleteRule(ruleId, userId);
  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.status as 400 | 403 | 404);
  }
  return c.json({ success: true });
});
