import { Hono } from "hono";
import { db, tab as tabTable, tabMember, user } from "db";
import { eq, and, inArray, ne } from "drizzle-orm";
import {
  createExpenseSchema,
  createExpenseAddedNotificationPayload,
  createExpenseUpdatedNotificationPayload,
  createExpenseDeletedNotificationPayload,
  createExpenseRestoredNotificationPayload,
  createExpensesBulkImportedNotificationPayload,
} from "models";
import type { AuthContext } from "../auth.js";
import { authMiddleware } from "../auth.js";
import { expense } from "data";
import { publishNotification } from "../lib/redis.js";
import { log } from "../lib/logger.js";

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
  const { expenses, total } = await expense.getForTab(tabId, options);
  log("info", "Expenses list fetched", { userId, tabId, total, limit: options.limit, filter });
  return c.json({ success: true, expenses, total });
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

  const exp = await expense.getById(expenseId);
  if (!exp || exp.tabId !== tabId) {
    return c.json({ success: false, error: "Expense not found" }, 404);
  }

  log("info", "Expense fetched", { userId, tabId, expenseId });
  return c.json({ success: true, expense: exp });
});

expensesRoutes.get("/:expenseId/audit-log", async (c) => {
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

  const exp = await expense.getById(expenseId);
  if (!exp || exp.tabId !== tabId) {
    return c.json({ success: false, error: "Expense not found" }, 404);
  }

  const auditLog = await expense.getAuditLog(expenseId);
  log("info", "Expense audit log fetched", { userId, tabId, expenseId });
  return c.json({ success: true, auditLog });
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

  if (members.length < 1) {
    return c.json(
      { success: false, error: "At least one person must be in the split" },
      400
    );
  }

  if (
    members.length === 1 &&
    members[0].userId === parsed.data.paidById
  ) {
    return c.json(
      { success: false, error: "Payer cannot be the only member of the split" },
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

  const expenseId = await expense.create({
    tabId: parsed.data.tabId,
    paidById: parsed.data.paidById,
    amount: parsed.data.amount,
    description: parsed.data.description,
    splitType: parsed.data.splitType,
    expenseDate: parsed.data.expenseDate,
    splits,
    performedById: userId,
  });

  const [tabRow] = await db
    .select({ name: tabTable.name, isDirect: tabTable.isDirect, currency: tabTable.currency })
    .from(tabTable)
    .where(eq(tabTable.id, parsed.data.tabId))
    .limit(1);

  let tabDisplayName = tabRow?.name ?? "Tab";
  if (tabRow?.isDirect) {
    const [otherUser] = await db
      .select({ name: user.name, username: user.username })
      .from(tabMember)
      .innerJoin(user, eq(tabMember.userId, user.id))
      .where(
        and(
          eq(tabMember.tabId, parsed.data.tabId),
          ne(tabMember.userId, userId),
        ),
      )
      .limit(1);
    if (otherUser) {
      tabDisplayName =
        otherUser.name ??
        (otherUser.username ? `@${otherUser.username}` : null) ??
        tabDisplayName;
    }
  }

  const idsForParticipants = members.map((m) => m.userId);
  const participantUserRows =
    idsForParticipants.length > 0
      ? await db
          .select({ id: user.id, name: user.name, username: user.username })
          .from(user)
          .where(inArray(user.id, idsForParticipants))
      : [];
  const participantMap = new Map(
    participantUserRows.map((r) => [
      r.id,
      { userId: r.id, name: r.name, username: r.username },
    ]),
  );
  const splitByUser = new Map(splits.map((s) => [s.userId, s.amount]));
  const participants = idsForParticipants
    .map((id) => participantMap.get(id))
    .filter(Boolean)
    .map((p) => {
      const share = splitByUser.get(p!.userId) ?? 0;
      const isPayer = p!.userId === parsed.data.paidById;
      return {
        userId: p!.userId,
        name: p!.name ?? (p!.username ? `@${p!.username}` : null),
        paid: isPayer ? amount : undefined,
        owes: !isPayer ? share : undefined,
      };
    });

  const [fromUser] = await db
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  const recipientCount = members.filter((m) => m.userId !== userId).length;
  for (const m of members) {
    if (m.userId !== userId) {
      const recipientOweAmount = splitByUser.get(m.userId)?.toString();
      const payload = createExpenseAddedNotificationPayload({
        tabId: parsed.data.tabId,
        expenseId,
        tabName: tabRow?.name ?? "Tab",
        isDirect: tabRow?.isDirect ?? false,
        fromUserId: userId,
        fromUserName: fromUser?.name ?? null,
        description: parsed.data.description ?? "",
        amount: parsed.data.amount.toString(),
        recipientOweAmount,
        createdAt: new Date(),
      });
      await publishNotification(m.userId, payload);
    }
  }

  log("info", "Expense created", {
    userId,
    tabId: parsed.data.tabId,
    expenseId,
    amount: parsed.data.amount,
    recipientCount,
  });
  return c.json({
    success: true,
    expenseId,
    tabId: parsed.data.tabId,
    amount: parsed.data.amount,
    description: parsed.data.description,
    tabName: tabDisplayName,
    currency: tabRow?.currency ?? "USD",
    participants,
  });
});

expensesRoutes.post("/bulk", async (c) => {
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

  const body = await c.req.json().catch(() => ({}));
  const raw = Array.isArray(body.expenses) ? body.expenses : [];
  if (raw.length === 0) {
    return c.json({ success: false, error: "No expenses to import" }, 400);
  }

  const allMembers = await db
    .select()
    .from(tabMember)
    .where(eq(tabMember.tabId, tabId));

  const [tabRow] = await db
    .select({ name: tabTable.name })
    .from(tabTable)
    .where(eq(tabTable.id, tabId))
    .limit(1);

  const [fromUser] = await db
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  const BATCH_SIZE = 500;

  log("info", "Bulk import started", {
    tabId,
    userId,
    total: raw.length,
    batchSize: BATCH_SIZE,
  });

  type ValidatedExpense = {
    rowIndex: number;
    expenseRow: {
      tabId: string;
      paidById: string;
      amount: string;
      description: string;
      splitType: string;
      expenseDate: Date;
    };
    splits: { userId: string; amount: string }[];
  };

  const validated: ValidatedExpense[] = [];
  const errors: string[] = [];

  for (let i = 0; i < raw.length; i++) {
    const item = raw[i] as Record<string, unknown>;
    const parsed = createExpenseSchema.safeParse({
      ...item,
      tabId,
      paidById: item?.paidById ?? userId,
    });

    if (!parsed.success) {
      errors.push(`Row ${i + 1}: ${parsed.error.flatten().formErrors[0] ?? "Invalid"}`);
      continue;
    }

    const participantIds =
      (item.participantIds as string[] | undefined) ?? allMembers.map((m) => m.userId);
    const members =
      participantIds.length > 0
        ? allMembers.filter((m) => participantIds.includes(m.userId))
        : allMembers;

    if (members.length < 1) {
      errors.push(`Row ${i + 1}: At least one person must be in the split`);
      continue;
    }

    if (members.length === 1 && members[0].userId === parsed.data.paidById) {
      errors.push(`Row ${i + 1}: Payer cannot be the only member of the split`);
      continue;
    }

    const amount = parsed.data.amount;
    let splits: { userId: string; amount: number }[];

    if (parsed.data.splitType === "equal") {
      const perPerson = Math.floor((amount / members.length) * 100) / 100;
      const remainder = roundTo2(amount - perPerson * (members.length - 1));
      splits = members.map((m, idx) => ({
        userId: m.userId,
        amount: idx === members.length - 1 ? remainder : perPerson,
      }));
    } else if (parsed.data.splits && parsed.data.splits.length > 0) {
      splits = parsed.data.splits.map((s) => ({
        userId: s.userId,
        amount: roundTo2(s.amount),
      }));
    } else {
      errors.push(`Row ${i + 1}: Custom split requires splits array`);
      continue;
    }

    validated.push({
      rowIndex: i + 1,
      expenseRow: {
        tabId: parsed.data.tabId,
        paidById: parsed.data.paidById,
        amount: parsed.data.amount.toString(),
        description: parsed.data.description,
        splitType: parsed.data.splitType,
        expenseDate: parsed.data.expenseDate,
      },
      splits: splits.map((s) => ({ userId: s.userId, amount: s.amount.toString() })),
    });
  }

  log("info", "Bulk import validation complete", {
    tabId,
    validated: validated.length,
    validationErrors: errors.length,
  });

  let imported = 0;

  for (let b = 0; b < validated.length; b += BATCH_SIZE) {
    const batch = validated.slice(b, b + BATCH_SIZE);
    const batchNum = Math.floor(b / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(validated.length / BATCH_SIZE);

    log("info", "Bulk import batch start", {
      tabId,
      batch: batchNum,
      totalBatches,
      batchSize: batch.length,
    });

    try {
      const items = batch.map((v) => ({
        tabId: v.expenseRow.tabId,
        paidById: v.expenseRow.paidById,
        amount: v.expenseRow.amount,
        description: v.expenseRow.description,
        splitType: v.expenseRow.splitType,
        expenseDate: v.expenseRow.expenseDate,
        splits: v.splits,
      }));
      await expense.createBulk(items, userId);
      imported += batch.length;

      log("info", "Bulk import batch complete", {
        tabId,
        batch: batchNum,
        importedInBatch: batch.length,
        totalImported: imported,
      });
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      log("error", "Bulk import batch failed", {
        tabId,
        batch: batchNum,
        error: errMsg,
        rowIndices: batch.map((v) => v.rowIndex),
      });
      for (const v of batch) {
        errors.push(`Row ${v.rowIndex}: ${errMsg}`);
      }
    }
  }

  log("info", "Bulk import complete", {
    tabId,
    userId,
    imported,
    failed: raw.length - imported,
    errorCount: errors.length,
  });

  if (imported > 0) {
    const payload = createExpensesBulkImportedNotificationPayload({
      tabId,
      tabName: tabRow?.name ?? "Tab",
      fromUserId: userId,
      fromUserName: fromUser?.name ?? null,
      count: imported,
      createdAt: new Date(),
    });
    const bulkRecipientCount = allMembers.filter((m) => m.userId !== userId).length;
    for (const m of allMembers) {
      if (m.userId !== userId) {
        await publishNotification(m.userId, payload);
      }
    }
    log("info", "Bulk import notifications sent", {
      tabId,
      imported,
      recipientCount: bulkRecipientCount,
    });
  }

  return c.json({
    success: true,
    imported,
    failed: raw.length - imported,
    errors: errors.length > 0 ? errors : undefined,
  });
});

expensesRoutes.patch("/:expenseId", async (c) => {
  const { userId } = c.get("auth");
  const tabId = c.req.param("tabId")!;
  const expenseId = c.req.param("expenseId")!;

  const existingExp = await expense.getById(expenseId);
  if (!existingExp || existingExp.tabId !== tabId) {
    return c.json({ success: false, error: "Expense not found" }, 404);
  }

  if (existingExp.deletedAt) {
    return c.json({ success: false, error: "Cannot edit a deleted expense" }, 400);
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

  if (members.length < 1) {
    return c.json(
      { success: false, error: "At least one person must be in the split" },
      400
    );
  }

  if (
    members.length === 1 &&
    members[0].userId === parsed.data.paidById
  ) {
    return c.json(
      { success: false, error: "Payer cannot be the only member of the split" },
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

  const existingSplits = existingExp.splits.map((s) => ({
    userId: s.userId,
    amount: String(s.amount),
  }));
  await expense.update(
    expenseId,
    tabId,
    {
      paidById: parsed.data.paidById,
      amount: parsed.data.amount,
      description: parsed.data.description,
      splitType: parsed.data.splitType,
      expenseDate: parsed.data.expenseDate,
      splits,
      performedById: userId,
    },
    {
      amount: existingExp.amount.toString(),
      description: existingExp.description,
      paidById: existingExp.paidById,
      expenseDate: existingExp.expenseDate,
    },
    existingSplits,
  );

  const [tabRow] = await db
    .select({ name: tabTable.name, isDirect: tabTable.isDirect })
    .from(tabTable)
    .where(eq(tabTable.id, tabId))
    .limit(1);

  const [fromUser] = await db
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  const previousDescription = existingExp.description ?? "";
  const newDescription = parsed.data.description ?? previousDescription;
  const descriptionChanged = newDescription.trim() !== previousDescription.trim();
  const amountChanged =
    parsed.data.amount !== Number(existingExp.amount);
  const splitByUser = new Map(splits.map((s) => [s.userId, s.amount]));

  const recipientCount = members.filter((m) => m.userId !== userId).length;
  for (const m of members) {
    if (m.userId !== userId) {
      const recipientOweAmount = splitByUser.get(m.userId)?.toString();
      const payload = createExpenseUpdatedNotificationPayload({
        tabId,
        expenseId,
        tabName: tabRow?.name ?? "Tab",
        isDirect: tabRow?.isDirect ?? false,
        fromUserId: userId,
        fromUserName: fromUser?.name ?? null,
        description: parsed.data.description ?? "",
        amount: parsed.data.amount.toString(),
        recipientOweAmount,
        descriptionChanged,
        amountChanged,
        previousDescription: existingExp.description ?? "",
        createdAt: new Date(),
      });
      await publishNotification(m.userId, payload);
    }
  }

  log("info", "Expense updated", {
    userId,
    tabId,
    expenseId,
    amount: parsed.data.amount,
    recipientCount,
  });
  return c.json({ success: true });
});

expensesRoutes.delete("/:expenseId", async (c) => {
  const { userId } = c.get("auth");
  const tabId = c.req.param("tabId")!;
  const expenseId = c.req.param("expenseId")!;

  const exp = await expense.getById(expenseId);
  if (!exp || exp.tabId !== tabId) {
    return c.json({ success: false, error: "Expense not found" }, 404);
  }

  if (exp.deletedAt) {
    return c.json({ success: false, error: "Expense already deleted" }, 400);
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

  const [tabRow] = await db
    .select({ name: tabTable.name, isDirect: tabTable.isDirect })
    .from(tabTable)
    .where(eq(tabTable.id, tabId))
    .limit(1);

  const [fromUser] = await db
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  await expense.delete(expenseId, tabId, userId);

  const participantIds = exp.splits.map((s) => s.userId);
  const deletedAt = new Date();
  for (const participantId of participantIds) {
    if (participantId !== userId) {
      const payload = createExpenseDeletedNotificationPayload({
        tabId,
        expenseId,
        tabName: tabRow?.name ?? "Tab",
        isDirect: tabRow?.isDirect ?? false,
        fromUserId: userId,
        fromUserName: fromUser?.name ?? null,
        description: exp.description,
        amount: exp.amount.toString(),
        deletedAt,
        createdAt: deletedAt,
      });
      await publishNotification(participantId, payload);
    }
  }

  log("info", "Expense deleted", { userId, tabId, expenseId });
  return c.json({ success: true });
});

expensesRoutes.post("/:expenseId/restore", async (c) => {
  const { userId } = c.get("auth");
  const tabId = c.req.param("tabId")!;
  const expenseId = c.req.param("expenseId")!;

  const exp = await expense.getById(expenseId);
  if (!exp || exp.tabId !== tabId) {
    return c.json({ success: false, error: "Expense not found" }, 404);
  }

  if (!exp.deletedAt) {
    return c.json({ success: false, error: "Expense is not deleted" }, 400);
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

  const [tabRow] = await db
    .select({ name: tabTable.name, isDirect: tabTable.isDirect })
    .from(tabTable)
    .where(eq(tabTable.id, tabId))
    .limit(1);

  const [fromUser] = await db
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  await expense.restore(expenseId, tabId, userId);

  const restoredAt = new Date();
  const participantIds = exp.splits.map((s) => s.userId);
  for (const participantId of participantIds) {
    if (participantId !== userId) {
      const payload = createExpenseRestoredNotificationPayload({
        tabId,
        expenseId,
        tabName: tabRow?.name ?? "Tab",
        isDirect: tabRow?.isDirect ?? false,
        fromUserId: userId,
        fromUserName: fromUser?.name ?? null,
        description: exp.description,
        amount: exp.amount.toString(),
        createdAt: restoredAt,
      });
      await publishNotification(participantId, payload);
    }
  }

  log("info", "Expense restored", { userId, tabId, expenseId });
  return c.json({ success: true });
});
