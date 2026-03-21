import { Hono } from "hono";
import {
  createTabSchema,
  addMemberSchema,
  updateTabSchema,
  recordSettlementSchema,
  updateSettlementSchema,
} from "models";
import type { AuthContext } from "../auth.js";
import { authMiddleware } from "../auth.js";
import { tabService, settlementService } from "services";
import { expensesRoutes } from "./expenses.js";

export const tabsRoutes = new Hono<{ Variables: { auth: AuthContext } }>();

tabsRoutes.use("*", authMiddleware);

tabsRoutes.get("/", async (c) => {
  const { userId } = c.get("auth");
  const result = await tabService.getTabsForUser(userId);
  return c.json({ success: true, tabs: result.data.tabs });
});

tabsRoutes.get("/:tabId", async (c) => {
  const { userId } = c.get("auth");
  const tabId = c.req.param("tabId")!;
  const result = await tabService.getWithMembers(tabId, userId);
  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.status as 400 | 403 | 404);
  }
  return c.json({ success: true, tab: result.data });
});

tabsRoutes.route("/:tabId/expenses", expensesRoutes);

tabsRoutes.get("/:tabId/settlements", async (c) => {
  const { userId } = c.get("auth");
  const tabId = c.req.param("tabId")!;
  const result = await settlementService.getForTab(tabId, userId);
  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.status as 400 | 403 | 404);
  }
  return c.json({ success: true, settlements: result.data });
});

tabsRoutes.get("/:tabId/settlements/:settlementId", async (c) => {
  const { userId } = c.get("auth");
  const tabId = c.req.param("tabId")!;
  const settlementId = c.req.param("settlementId")!;
  const result = await settlementService.getById(tabId, settlementId, userId);
  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.status as 400 | 403 | 404);
  }
  return c.json({ success: true, settlement: result.data });
});

tabsRoutes.get("/:tabId/settlements/:settlementId/audit-log", async (c) => {
  const { userId } = c.get("auth");
  const tabId = c.req.param("tabId")!;
  const settlementId = c.req.param("settlementId")!;
  const result = await settlementService.getAuditLog(tabId, settlementId, userId);
  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.status as 400 | 403 | 404);
  }
  return c.json({ success: true, auditLog: result.data });
});

tabsRoutes.patch("/:tabId/settlements/:settlementId", async (c) => {
  const { userId } = c.get("auth");
  const tabId = c.req.param("tabId")!;
  const settlementId = c.req.param("settlementId")!;

  const body = await c.req.json().catch(() => ({}));
  const parsed = updateSettlementSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { success: false, error: parsed.error.flatten().formErrors[0] },
      400,
    );
  }

  const result = await settlementService.update(
    tabId,
    settlementId,
    parsed.data.fromUserId,
    parsed.data.toUserId,
    parsed.data.amount,
    userId,
    parsed.data.currency,
    parsed.data.originalAmount,
    parsed.data.settlementDate,
  );
  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.status as 400 | 403 | 404);
  }
  return c.json({ success: true });
});

tabsRoutes.delete("/:tabId/settlements/:settlementId", async (c) => {
  const { userId } = c.get("auth");
  const tabId = c.req.param("tabId")!;
  const settlementId = c.req.param("settlementId")!;

  const result = await settlementService.delete(tabId, settlementId, userId);
  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.status as 400 | 403 | 404);
  }
  return c.json({ success: true });
});

tabsRoutes.get("/:tabId/balances", async (c) => {
  const { userId } = c.get("auth");
  const tabId = c.req.param("tabId")!;
  const result = await tabService.getBalancesForTab(tabId, userId);
  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.status as 400 | 403 | 404);
  }
  return c.json({ success: true, balances: result.data });
});

tabsRoutes.get("/:tabId/shared-group-tabs", async (c) => {
  const { userId } = c.get("auth");
  const tabId = c.req.param("tabId")!;
  const result = await tabService.getSharedGroupTabsForDirectTab(tabId, userId);
  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.status as 400 | 403 | 404);
  }
  return c.json({ success: true, tabs: result.data });
});

tabsRoutes.post("/", async (c) => {
  const { userId } = c.get("auth");

  const body = await c.req.json().catch(() => ({}));
  const parsed = createTabSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { success: false, error: parsed.error.flatten().formErrors[0] },
      400,
    );
  }

  const result = await tabService.create(
    parsed.data.name,
    userId,
    parsed.data.currency,
  );
  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.status as 400 | 403 | 404);
  }
  return c.json({ success: true, tabId: result.data.tabId });
});

tabsRoutes.patch("/:tabId", async (c) => {
  const { userId } = c.get("auth");
  const tabId = c.req.param("tabId")!;

  const body = await c.req.json().catch(() => ({}));
  const parsed = updateTabSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { success: false, error: parsed.error.flatten().formErrors[0] },
      400,
    );
  }

  const updates: { name?: string; currency?: string } = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name.trim();
  if (parsed.data.currency !== undefined)
    updates.currency = parsed.data.currency.trim();

  const result = await tabService.update(tabId, userId, updates);
  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.status as 400 | 403 | 404);
  }
  return c.json({ success: true });
});

tabsRoutes.post("/:tabId/members", async (c) => {
  const { userId } = c.get("auth");
  const tabId = c.req.param("tabId")!;

  const body = await c.req.json().catch(() => ({}));
  const parsed = addMemberSchema.safeParse({ ...body, tabId });

  if (!parsed.success) {
    return c.json(
      { success: false, error: parsed.error.flatten().formErrors[0] },
      400,
    );
  }

  const result = await tabService.addMember(
    tabId,
    userId,
    parsed.data.email,
    parsed.data.role,
  );
  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.status as 400 | 403 | 404);
  }
  return c.json({ success: true });
});

tabsRoutes.delete("/:tabId/members", async (c) => {
  const { userId } = c.get("auth");
  const tabId = c.req.param("tabId")!;

  const body = await c.req.json().catch(() => ({}));
  const targetUserId = body.userId;

  if (typeof targetUserId !== "string") {
    return c.json({ success: false, error: "userId required" }, 400);
  }

  const result = await tabService.removeMember(tabId, userId, targetUserId);
  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.status as 400 | 403 | 404);
  }
  return c.json({ success: true });
});

tabsRoutes.post("/:tabId/settlements", async (c) => {
  const { userId } = c.get("auth");
  const tabId = c.req.param("tabId")!;

  const body = await c.req.json().catch(() => ({}));
  const parsed = recordSettlementSchema.safeParse({ ...body, tabId });

  if (!parsed.success) {
    return c.json(
      { success: false, error: parsed.error.flatten().formErrors[0] },
      400,
    );
  }

  const result = await settlementService.record(
    tabId,
    parsed.data.fromUserId,
    parsed.data.toUserId,
    parsed.data.amount,
    userId,
    parsed.data.currency,
    parsed.data.originalAmount,
    parsed.data.settlementDate,
  );
  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.status as 400 | 403 | 404);
  }
  return c.json({ success: true });
});
