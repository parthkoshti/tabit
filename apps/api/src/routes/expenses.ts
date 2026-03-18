import { Hono } from "hono";
import { createExpenseSchema } from "models";
import type { AuthContext } from "../auth.js";
import { authMiddleware } from "../auth.js";
import { expenseService } from "services";
import { log } from "../lib/logger.js";

export const expensesRoutes = new Hono<{ Variables: { auth: AuthContext } }>();

expensesRoutes.use("*", authMiddleware);

expensesRoutes.get("/", async (c) => {
  const { userId } = c.get("auth");
  const tabId = c.req.param("tabId")!;

  const limit = c.req.query("limit");
  const offset = c.req.query("offset");
  const rawFilter = c.req.query("filter");
  const validFilters = ["all", "involved", "owed", "owe"] as const;
  const filter = validFilters.includes(rawFilter as (typeof validFilters)[number])
    ? (rawFilter as (typeof validFilters)[number])
    : "all";

  const options: { limit?: number; offset?: number; filter?: (typeof validFilters)[number]; userId?: string } =
    limit !== undefined
      ? { limit: parseInt(limit, 10) || 50, offset: parseInt(offset ?? "0", 10) || 0 }
      : {};
  if (filter !== "all") {
    options.filter = filter;
    options.userId = userId;
  }

  const result = await expenseService.getForTab(tabId, userId, options);
  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.status as 400 | 403 | 404);
  }

  log("info", "Expenses list fetched", {
    userId,
    tabId,
    total: result.data.total,
    limit: options.limit,
    filter,
  });
  return c.json({ success: true, expenses: result.data.expenses, total: result.data.total });
});

expensesRoutes.get("/:expenseId", async (c) => {
  const { userId } = c.get("auth");
  const tabId = c.req.param("tabId")!;
  const expenseId = c.req.param("expenseId")!;

  const result = await expenseService.getById(tabId, expenseId, userId);
  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.status as 400 | 403 | 404);
  }

  log("info", "Expense fetched", { userId, tabId, expenseId });
  return c.json({ success: true, expense: result.data });
});

expensesRoutes.get("/:expenseId/audit-log", async (c) => {
  const { userId } = c.get("auth");
  const tabId = c.req.param("tabId")!;
  const expenseId = c.req.param("expenseId")!;

  const result = await expenseService.getAuditLog(tabId, expenseId, userId);
  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.status as 400 | 403 | 404);
  }

  log("info", "Expense audit log fetched", { userId, tabId, expenseId });
  return c.json({ success: true, auditLog: result.data });
});

expensesRoutes.post("/", async (c) => {
  const { userId } = c.get("auth");
  const tabId = c.req.param("tabId")!;

  const body = await c.req.json().catch(() => ({}));
  const parsed = createExpenseSchema.safeParse({
    ...body,
    tabId,
    paidById: body.paidById ?? userId,
  });

  if (!parsed.success) {
    return c.json(
      { success: false, error: parsed.error.flatten().formErrors[0] },
      400,
    );
  }

  const result = await expenseService.create(
    {
      ...parsed.data,
      participantIds: body.participantIds as string[] | undefined,
    },
    userId,
  );

  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.status as 400 | 403 | 404);
  }

  log("info", "Expense created", {
    userId,
    tabId: result.data.tabId,
    expenseId: result.data.expenseId,
    amount: result.data.amount,
    recipientCount: result.data.participants.filter((p) => p.userId !== userId).length,
  });
  return c.json({
    success: true,
    expenseId: result.data.expenseId,
    tabId: result.data.tabId,
    amount: result.data.amount,
    description: result.data.description,
    tabName: result.data.tabName,
    currency: result.data.currency,
    participants: result.data.participants,
  });
});

expensesRoutes.post("/bulk", async (c) => {
  const { userId } = c.get("auth");
  const tabId = c.req.param("tabId")!;

  const body = await c.req.json().catch(() => ({}));
  const raw = Array.isArray(body.expenses) ? body.expenses : [];

  const result = await expenseService.createBulk(tabId, raw, userId);

  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.status as 400 | 403 | 404);
  }

  log("info", "Bulk import complete", {
    tabId,
    userId,
    imported: result.data.imported,
    failed: result.data.failed,
    errorCount: result.data.errors?.length ?? 0,
  });
  return c.json({
    success: true,
    imported: result.data.imported,
    failed: result.data.failed,
    errors: result.data.errors,
  });
});

expensesRoutes.patch("/:expenseId", async (c) => {
  const { userId } = c.get("auth");
  const tabId = c.req.param("tabId")!;
  const expenseId = c.req.param("expenseId")!;

  const body = await c.req.json().catch(() => ({}));
  const parsed = createExpenseSchema.safeParse({
    ...body,
    tabId,
    paidById: body.paidById ?? userId,
  });

  if (!parsed.success) {
    return c.json(
      { success: false, error: parsed.error.flatten().formErrors[0] },
      400,
    );
  }

  const result = await expenseService.update(
    tabId,
    expenseId,
    {
      ...parsed.data,
      participantIds: body.participantIds as string[] | undefined,
    },
    userId,
  );

  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.status as 400 | 403 | 404);
  }

  log("info", "Expense updated", { userId, tabId, expenseId });
  return c.json({ success: true });
});

expensesRoutes.delete("/:expenseId", async (c) => {
  const { userId } = c.get("auth");
  const tabId = c.req.param("tabId")!;
  const expenseId = c.req.param("expenseId")!;

  const result = await expenseService.delete(tabId, expenseId, userId);
  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.status as 400 | 403 | 404);
  }

  log("info", "Expense deleted", { userId, tabId, expenseId });
  return c.json({ success: true });
});

expensesRoutes.post("/:expenseId/restore", async (c) => {
  const { userId } = c.get("auth");
  const tabId = c.req.param("tabId")!;
  const expenseId = c.req.param("expenseId")!;

  const result = await expenseService.restore(tabId, expenseId, userId);
  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.status as 400 | 403 | 404);
  }

  log("info", "Expense restored", { userId, tabId, expenseId });
  return c.json({ success: true });
});

expensesRoutes.post("/:expenseId/reactions", async (c) => {
  const { userId } = c.get("auth");
  const tabId = c.req.param("tabId")!;
  const expenseId = c.req.param("expenseId")!;

  const body = await c.req.json().catch(() => ({}));
  const emoji = body.emoji;

  const result = await expenseService.addReaction(tabId, expenseId, emoji, userId);
  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.status as 400 | 403 | 404);
  }

  log("info", "Expense reaction added", { userId, tabId, expenseId });
  return c.json({ success: true });
});

expensesRoutes.delete("/:expenseId/reactions", async (c) => {
  const { userId } = c.get("auth");
  const tabId = c.req.param("tabId")!;
  const expenseId = c.req.param("expenseId")!;

  const result = await expenseService.removeReaction(tabId, expenseId, userId);
  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.status as 400 | 403 | 404);
  }

  log("info", "Expense reaction removed", { userId, tabId, expenseId });
  return c.json({ success: true });
});
