import { Hono } from "hono";
import { db, tabMember, user } from "db";
import { CURRENCY_CODES } from "shared";
import { eq, and } from "drizzle-orm";
import {
  createTabSchema,
  addMemberSchema,
  updateTabSchema,
  recordSettlementSchema,
  updateSettlementSchema,
} from "models";
import type { AuthContext } from "../auth.js";
import { authMiddleware } from "../auth.js";
import { tab, settlement } from "data";
import { expensesRoutes } from "./expenses.js";

export const tabsRoutes = new Hono<{ Variables: { auth: AuthContext } }>();

tabsRoutes.use("*", authMiddleware);

tabsRoutes.get("/", async (c) => {
  const { userId } = c.get("auth");
  const tabs = await tab.getTabsForUser(userId, {
    includeDirect: false,
    includeBalance: true,
    includeMemberIds: true,
    includeLastExpenseDate: true,
    includeExpenseCount: true,
  });
  return c.json({ success: true, tabs });
});

tabsRoutes.get("/:tabId", async (c) => {
  const { userId } = c.get("auth");
  const tabId = c.req.param("tabId");
  const tabData = await tab.getWithMembers(tabId);
  if (!tabData) {
    return c.json({ success: false, error: "Tab not found" }, 404);
  }
  const isMember = tabData.members.some((m) => m.userId === userId);
  if (!isMember) {
    return c.json({ success: false, error: "Not a member" }, 403);
  }
  return c.json({ success: true, tab: tabData });
});

tabsRoutes.route("/:tabId/expenses", expensesRoutes);

tabsRoutes.get("/:tabId/settlements", async (c) => {
  const { userId } = c.get("auth");
  const tabId = c.req.param("tabId");
  const tabData = await tab.getWithMembers(tabId);
  if (!tabData) {
    return c.json({ success: false, error: "Tab not found" }, 404);
  }
  const isMember = tabData.members.some((m) => m.userId === userId);
  if (!isMember) {
    return c.json({ success: false, error: "Not a member" }, 403);
  }
  const settlements = await settlement.getForTab(tabId);
  return c.json({ success: true, settlements });
});

tabsRoutes.get("/:tabId/settlements/:settlementId", async (c) => {
  const { userId } = c.get("auth");
  const tabId = c.req.param("tabId");
  const settlementId = c.req.param("settlementId");
  const tabData = await tab.getWithMembers(tabId);
  if (!tabData) {
    return c.json({ success: false, error: "Tab not found" }, 404);
  }
  const isMember = tabData.members.some((m) => m.userId === userId);
  if (!isMember) {
    return c.json({ success: false, error: "Not a member" }, 403);
  }
  const s = await settlement.getById(settlementId);
  if (!s || s.tabId !== tabId) {
    return c.json({ success: false, error: "Settlement not found" }, 404);
  }
  return c.json({ success: true, settlement: s });
});

tabsRoutes.get("/:tabId/settlements/:settlementId/audit-log", async (c) => {
  const { userId } = c.get("auth");
  const tabId = c.req.param("tabId");
  const settlementId = c.req.param("settlementId");
  const tabData = await tab.getWithMembers(tabId);
  if (!tabData) {
    return c.json({ success: false, error: "Tab not found" }, 404);
  }
  const isMember = tabData.members.some((m) => m.userId === userId);
  if (!isMember) {
    return c.json({ success: false, error: "Not a member" }, 403);
  }
  const s = await settlement.getById(settlementId);
  if (!s || s.tabId !== tabId) {
    return c.json({ success: false, error: "Settlement not found" }, 404);
  }
  const auditLog = await settlement.getAuditLog(settlementId);
  return c.json({ success: true, auditLog });
});

tabsRoutes.patch("/:tabId/settlements/:settlementId", async (c) => {
  const { userId } = c.get("auth");
  const tabId = c.req.param("tabId");
  const settlementId = c.req.param("settlementId");

  const existing = await settlement.getById(settlementId);
  if (!existing || existing.tabId !== tabId) {
    return c.json({ success: false, error: "Settlement not found" }, 404);
  }

  const [member] = await db
    .select()
    .from(tabMember)
    .where(and(eq(tabMember.tabId, tabId), eq(tabMember.userId, userId)))
    .limit(1);

  if (!member) {
    return c.json({ success: false, error: "Not a member" }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = updateSettlementSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { success: false, error: parsed.error.flatten().formErrors[0] },
      400
    );
  }

  const [fromIsMember] = await db
    .select()
    .from(tabMember)
    .where(
      and(
        eq(tabMember.tabId, tabId),
        eq(tabMember.userId, parsed.data.fromUserId)
      )
    )
    .limit(1);

  const [toIsMember] = await db
    .select()
    .from(tabMember)
    .where(
      and(
        eq(tabMember.tabId, tabId),
        eq(tabMember.userId, parsed.data.toUserId)
      )
    )
    .limit(1);

  if (!fromIsMember || !toIsMember) {
    return c.json(
      { success: false, error: "Both payer and payee must be tab members" },
      400
    );
  }

  if (parsed.data.fromUserId === parsed.data.toUserId) {
    return c.json(
      { success: false, error: "Payer and payee must be different people" },
      400
    );
  }

  await settlement.update(settlementId, tabId, {
    fromUserId: parsed.data.fromUserId,
    toUserId: parsed.data.toUserId,
    amount: parsed.data.amount,
    performedById: userId,
  });

  return c.json({ success: true });
});

tabsRoutes.delete("/:tabId/settlements/:settlementId", async (c) => {
  const { userId } = c.get("auth");
  const tabId = c.req.param("tabId");
  const settlementId = c.req.param("settlementId");

  const s = await settlement.getById(settlementId);
  if (!s || s.tabId !== tabId) {
    return c.json({ success: false, error: "Settlement not found" }, 404);
  }

  const [member] = await db
    .select()
    .from(tabMember)
    .where(and(eq(tabMember.tabId, tabId), eq(tabMember.userId, userId)))
    .limit(1);

  if (!member) {
    return c.json({ success: false, error: "Not a member" }, 403);
  }

  await settlement.delete(settlementId, tabId, userId);

  return c.json({ success: true });
});

tabsRoutes.get("/:tabId/balances", async (c) => {
  const { userId } = c.get("auth");
  const tabId = c.req.param("tabId");
  const tabData = await tab.getWithMembers(tabId);
  if (!tabData) {
    return c.json({ success: false, error: "Tab not found" }, 404);
  }
  const isMember = tabData.members.some((m) => m.userId === userId);
  if (!isMember) {
    return c.json({ success: false, error: "Not a member" }, 403);
  }
  const balances = await tab.getBalancesForTab(tabId);
  return c.json({ success: true, balances });
});

tabsRoutes.post("/", async (c) => {
  const { userId } = c.get("auth");

  const body = await c.req.json().catch(() => ({}));
  const parsed = createTabSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { success: false, error: parsed.error.flatten().formErrors[0] },
      400
    );
  }

  let currency = parsed.data.currency?.trim();
  if (currency !== undefined) {
    if (!(CURRENCY_CODES as readonly string[]).includes(currency)) {
      return c.json(
        { success: false, error: "Invalid currency code" },
        400
      );
    }
  } else {
    const [creator] = await db
      .select({ defaultCurrency: user.defaultCurrency })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    currency = creator?.defaultCurrency ?? "USD";
  }

  const id = await tab.create(parsed.data.name, userId, currency);

  return c.json({ success: true, tabId: id });
});

tabsRoutes.patch("/:tabId", async (c) => {
  const { userId } = c.get("auth");
  const tabId = c.req.param("tabId");

  const body = await c.req.json().catch(() => ({}));
  const parsed = updateTabSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { success: false, error: parsed.error.flatten().formErrors[0] },
      400
    );
  }

  const updates: { name?: string; currency?: string } = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name.trim();
  if (parsed.data.currency !== undefined)
    updates.currency = parsed.data.currency.trim();

  if (Object.keys(updates).length === 0) {
    return c.json(
      { success: false, error: "Provide name or currency to update" },
      400
    );
  }

  const [currentUserMember] = await db
    .select()
    .from(tabMember)
    .where(and(eq(tabMember.tabId, tabId), eq(tabMember.userId, userId)))
    .limit(1);

  if (!currentUserMember) {
    return c.json(
      { success: false, error: "Not a member of this tab" },
      403
    );
  }

  const existingTab = await tab.getWithMembers(tabId);
  if (!existingTab) {
    return c.json({ success: false, error: "Tab not found" }, 404);
  }

  if (updates.name !== undefined) {
    if (existingTab.isDirect) {
      return c.json(
        { success: false, error: "Direct tabs cannot be renamed" },
        400
      );
    }
  }

  if (updates.currency !== undefined) {
    if (!(CURRENCY_CODES as readonly string[]).includes(updates.currency)) {
      return c.json(
        { success: false, error: "Invalid currency code" },
        400
      );
    }
  }

  await tab.update(tabId, updates);

  return c.json({ success: true });
});

tabsRoutes.post("/:tabId/members", async (c) => {
  const { userId } = c.get("auth");
  const tabId = c.req.param("tabId");

  const body = await c.req.json().catch(() => ({}));
  const parsed = addMemberSchema.safeParse({
    ...body,
    tabId,
  });

  if (!parsed.success) {
    return c.json(
      { success: false, error: parsed.error.flatten().formErrors[0] },
      400
    );
  }

  const [member] = await db
    .select()
    .from(tabMember)
    .where(and(eq(tabMember.tabId, tabId), eq(tabMember.userId, userId)))
    .limit(1);

  if (!member) {
    return c.json({ success: false, error: "Not a member of this tab" }, 403);
  }

  const [targetUser] = await db
    .select()
    .from(user)
    .where(eq(user.email, parsed.data.email))
    .limit(1);

  if (!targetUser) {
    return c.json(
      { success: false, error: "User not found with that email" },
      404
    );
  }

  const [existing] = await db
    .select()
    .from(tabMember)
    .where(
      and(
        eq(tabMember.tabId, parsed.data.tabId),
        eq(tabMember.userId, targetUser.id)
      )
    )
    .limit(1);

  if (existing) {
    return c.json({ success: false, error: "User is already a member" }, 400);
  }

  await tab.addMember(parsed.data.tabId, targetUser.id, parsed.data.role);

  return c.json({ success: true });
});

tabsRoutes.delete("/:tabId/members", async (c) => {
  const { userId } = c.get("auth");
  const tabId = c.req.param("tabId");

  const body = await c.req.json().catch(() => ({}));
  const targetUserId = body.userId;

  if (typeof targetUserId !== "string") {
    return c.json({ success: false, error: "userId required" }, 400);
  }

  if (targetUserId === userId) {
    return c.json({ success: false, error: "Use leave to remove yourself" }, 400);
  }

  const [currentUserMember] = await db
    .select()
    .from(tabMember)
    .where(and(eq(tabMember.tabId, tabId), eq(tabMember.userId, userId)))
    .limit(1);

  if (!currentUserMember) {
    return c.json(
      { success: false, error: "Not a member of this tab" },
      403
    );
  }

  const [targetMember] = await db
    .select()
    .from(tabMember)
    .where(
      and(eq(tabMember.tabId, tabId), eq(tabMember.userId, targetUserId))
    )
    .limit(1);

  if (!targetMember) {
    return c.json({ success: false, error: "User is not a member of this tab" }, 404);
  }

  await tab.removeMember(tabId, targetUserId);

  return c.json({ success: true });
});

tabsRoutes.post("/:tabId/settlements", async (c) => {
  const { userId } = c.get("auth");
  const tabId = c.req.param("tabId");

  const body = await c.req.json().catch(() => ({}));
  const parsed = recordSettlementSchema.safeParse({
    ...body,
    tabId,
  });

  if (!parsed.success) {
    return c.json(
      { success: false, error: parsed.error.flatten().formErrors[0] },
      400
    );
  }

  const [member] = await db
    .select()
    .from(tabMember)
    .where(
      and(eq(tabMember.tabId, parsed.data.tabId), eq(tabMember.userId, userId))
    )
    .limit(1);

  if (!member) {
    return c.json({ success: false, error: "Not a member of this tab" }, 403);
  }

  const [fromIsMember] = await db
    .select()
    .from(tabMember)
    .where(
      and(
        eq(tabMember.tabId, parsed.data.tabId),
        eq(tabMember.userId, parsed.data.fromUserId)
      )
    )
    .limit(1);

  const [toIsMember] = await db
    .select()
    .from(tabMember)
    .where(
      and(
        eq(tabMember.tabId, parsed.data.tabId),
        eq(tabMember.userId, parsed.data.toUserId)
      )
    )
    .limit(1);

  if (!fromIsMember || !toIsMember) {
    return c.json(
      { success: false, error: "Both payer and payee must be tab members" },
      400
    );
  }

  if (parsed.data.fromUserId === parsed.data.toUserId) {
    return c.json(
      { success: false, error: "Payer and payee must be different people" },
      400
    );
  }

  await settlement.record({
    tabId: parsed.data.tabId,
    fromUserId: parsed.data.fromUserId,
    toUserId: parsed.data.toUserId,
    amount: parsed.data.amount,
    performedById: userId,
  });

  return c.json({ success: true });
});
