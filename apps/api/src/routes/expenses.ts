import { Hono } from "hono";
import {
  db,
  expense,
  expenseAuditLog,
  expenseSplit,
  tabMember,
} from "db";
import { eq, and } from "drizzle-orm";
import { createExpenseSchema } from "models";
import type { AuthContext } from "../auth.js";
import { authMiddleware } from "../auth.js";
import { getExpenseById, getExpensesForTab } from "data";

function roundTo2(n: number) {
  return Math.round(n * 100) / 100;
}

export const expensesRoutes = new Hono<{ Variables: { auth: AuthContext } }>();

expensesRoutes.use("*", authMiddleware);

expensesRoutes.get("/", async (c) => {
  const { userId } = c.get("auth");
  const tabId = c.req.param("tabId")!;

  const [member] = await db
    .select()
    .from(tabMember)
    .where(and(eq(tabMember.tabId, tabId), eq(tabMember.userId, userId)))
    .limit(1);

  if (!member) {
    return c.json({ success: false, error: "Not a member" }, 403);
  }

  const expenses = await getExpensesForTab(tabId);
  return c.json({ success: true, expenses });
});

expensesRoutes.get("/:expenseId", async (c) => {
  const { userId } = c.get("auth");
  const tabId = c.req.param("tabId")!;
  const expenseId = c.req.param("expenseId")!;

  const [member] = await db
    .select()
    .from(tabMember)
    .where(and(eq(tabMember.tabId, tabId), eq(tabMember.userId, userId)))
    .limit(1);

  if (!member) {
    return c.json({ success: false, error: "Not a member" }, 403);
  }

  const exp = await getExpenseById(expenseId);
  if (!exp || exp.tabId !== tabId) {
    return c.json({ success: false, error: "Expense not found" }, 404);
  }

  return c.json({ success: true, expense: exp });
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

  const [payerIsMember] = await db
    .select()
    .from(tabMember)
    .where(
      and(
        eq(tabMember.tabId, parsed.data.tabId),
        eq(tabMember.userId, parsed.data.paidById)
      )
    )
    .limit(1);

  if (!payerIsMember) {
    return c.json({ success: false, error: "Payer must be a member" }, 400);
  }

  const allMembers = await db
    .select()
    .from(tabMember)
    .where(eq(tabMember.tabId, parsed.data.tabId));

  const participantIds =
    (body.participantIds as string[] | undefined) ?? allMembers.map((m) => m.userId);
  const members =
    participantIds.length > 0
      ? allMembers.filter((m) => participantIds.includes(m.userId))
      : allMembers;

  if (members.length < 2) {
    return c.json(
      { success: false, error: "Add at least one other person to split with" },
      400
    );
  }

  const amount = parsed.data.amount;
  let splits: { userId: string; amount: number }[];

  if (parsed.data.splitType === "equal") {
    const perPerson = Math.floor((amount / members.length) * 100) / 100;
    const remainder = roundTo2(amount - perPerson * (members.length - 1));
    splits = members.map((m, i) => ({
      userId: m.userId,
      amount: i === members.length - 1 ? remainder : perPerson,
    }));
  } else if (parsed.data.splits && parsed.data.splits.length > 0) {
    splits = parsed.data.splits.map((s) => ({
      userId: s.userId,
      amount: roundTo2(s.amount),
    }));
  } else {
    return c.json(
      { success: false, error: "Custom split requires splits array" },
      400
    );
  }

  const [inserted] = await db
    .insert(expense)
    .values({
      tabId: parsed.data.tabId,
      paidById: parsed.data.paidById,
      amount: parsed.data.amount.toString(),
      description: parsed.data.description,
      splitType: parsed.data.splitType,
      expenseDate: parsed.data.expenseDate,
    })
    .returning({ id: expense.id });
  const expenseId = inserted!.id;

  for (const s of splits) {
    await db.insert(expenseSplit).values({
      expenseId,
      userId: s.userId,
      amount: s.amount.toString(),
    });
  }

  await db.insert(expenseAuditLog).values({
    expenseId,
    tabId: parsed.data.tabId,
    action: "create",
    performedById: userId,
    changes: null,
  });

  return c.json({ success: true, expenseId });
});

expensesRoutes.patch("/:expenseId", async (c) => {
  const { userId } = c.get("auth");
  const tabId = c.req.param("tabId")!;
  const expenseId = c.req.param("expenseId")!;

  const [existing] = await db
    .select()
    .from(expense)
    .where(eq(expense.id, expenseId))
    .limit(1);

  if (!existing || existing.tabId !== tabId) {
    return c.json({ success: false, error: "Expense not found" }, 404);
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
  const parsed = createExpenseSchema.safeParse({
    ...body,
    tabId,
    paidById: body.paidById ?? userId,
  });

  if (!parsed.success) {
    return c.json(
      { success: false, error: parsed.error.flatten().formErrors[0] },
      400
    );
  }

  const [payerIsMember] = await db
    .select()
    .from(tabMember)
    .where(
      and(
        eq(tabMember.tabId, tabId),
        eq(tabMember.userId, parsed.data.paidById)
      )
    )
    .limit(1);

  if (!payerIsMember) {
    return c.json({ success: false, error: "Payer must be a member" }, 400);
  }

  const allMembers = await db
    .select()
    .from(tabMember)
    .where(eq(tabMember.tabId, tabId));

  const participantIds =
    (body.participantIds as string[] | undefined) ?? allMembers.map((m) => m.userId);
  const members =
    participantIds.length > 0
      ? allMembers.filter((m) => participantIds.includes(m.userId))
      : allMembers;

  if (members.length < 2) {
    return c.json(
      { success: false, error: "Add at least one other person to split with" },
      400
    );
  }

  const amount = parsed.data.amount;
  let splits: { userId: string; amount: number }[];

  if (parsed.data.splitType === "equal") {
    const perPerson = Math.floor((amount / members.length) * 100) / 100;
    const remainder = roundTo2(amount - perPerson * (members.length - 1));
    splits = members.map((m, i) => ({
      userId: m.userId,
      amount: i === members.length - 1 ? remainder : perPerson,
    }));
  } else if (parsed.data.splits && parsed.data.splits.length > 0) {
    splits = parsed.data.splits.map((s) => ({
      userId: s.userId,
      amount: roundTo2(s.amount),
    }));
  } else {
    return c.json(
      { success: false, error: "Custom split requires splits array" },
      400
    );
  }

  await db
    .update(expense)
    .set({
      paidById: parsed.data.paidById,
      amount: parsed.data.amount.toString(),
      description: parsed.data.description,
      splitType: parsed.data.splitType,
      expenseDate: parsed.data.expenseDate,
    })
    .where(eq(expense.id, expenseId));

  await db.delete(expenseSplit).where(eq(expenseSplit.expenseId, expenseId));

  for (const s of splits) {
    await db.insert(expenseSplit).values({
      expenseId,
      userId: s.userId,
      amount: s.amount.toString(),
    });
  }

  await db.insert(expenseAuditLog).values({
    expenseId,
    tabId,
    action: "update",
    performedById: userId,
    changes: null,
  });

  return c.json({ success: true });
});

expensesRoutes.delete("/:expenseId", async (c) => {
  const { userId } = c.get("auth");
  const tabId = c.req.param("tabId")!;
  const expenseId = c.req.param("expenseId")!;

  const [exp] = await db
    .select()
    .from(expense)
    .where(eq(expense.id, expenseId))
    .limit(1);

  if (!exp || exp.tabId !== tabId) {
    return c.json({ success: false, error: "Expense not found" }, 404);
  }

  const [member] = await db
    .select()
    .from(tabMember)
    .where(
      and(eq(tabMember.tabId, tabId), eq(tabMember.userId, userId))
    )
    .limit(1);

  if (!member) {
    return c.json({ success: false, error: "Not a member" }, 403);
  }

  await db.insert(expenseAuditLog).values({
    expenseId,
    tabId,
    action: "delete",
    performedById: userId,
    changes: null,
  });

  await db.delete(expenseSplit).where(eq(expenseSplit.expenseId, expenseId));
  await db.delete(expense).where(eq(expense.id, expenseId));

  return c.json({ success: true });
});
