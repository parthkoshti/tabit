import { expense, tab, user as userData } from "data";
import type { GetExpensesForTabOptions } from "data";
import { createExpenseSchema } from "models";
import { ok, err, type Result } from "./types.js";
import { notificationService } from "./notification.js";

function roundTo2(n: number): number {
  return Math.round(n * 100) / 100;
}

function calculateSplits(
  amount: number,
  members: Array<{ userId: string }>,
  splitType: string,
  customSplits?: Array<{ userId: string; amount: number }>,
): { userId: string; amount: number }[] | null {
  if (members.length < 1) return null;
  if (members.length === 1) return null;

  if (splitType === "equal") {
    const perPerson = Math.floor((amount / members.length) * 100) / 100;
    const remainder = roundTo2(amount - perPerson * (members.length - 1));
    return members.map((m, i) => ({
      userId: m.userId,
      amount: i === members.length - 1 ? remainder : perPerson,
    }));
  }

  if (splitType === "custom" && customSplits && customSplits.length > 0) {
    return customSplits.map((s) => ({
      userId: s.userId,
      amount: roundTo2(s.amount),
    }));
  }

  return null;
}

export type CreateExpenseInput = {
  tabId: string;
  paidById: string;
  amount: number;
  description: string;
  splitType: "equal" | "custom";
  expenseDate: Date;
  participantIds?: string[];
  splits?: Array<{ userId: string; amount: number }>;
};

export type CreateExpenseSuccess = {
  expenseId: string;
  tabId: string;
  amount: number;
  description: string;
  tabName: string;
  currency: string;
  participants: Array<{
    userId: string;
    name: string | null;
    paid?: number;
    owes?: number;
  }>;
};

export const expenseService = {
  getForTab: async (
    tabId: string,
    userId: string,
    options?: GetExpensesForTabOptions,
  ): Promise<Result<{ expenses: Awaited<ReturnType<typeof expense.getForTab>>["expenses"]; total: number }>> => {
    const isMember = await tab.isMember(tabId, userId);
    if (!isMember) {
      return err("Not a member", 403);
    }
    const result = await expense.getForTab(tabId, options);
    return ok({ expenses: result.expenses, total: result.total });
  },

  getById: async (
    tabId: string,
    expenseId: string,
    userId: string,
  ): Promise<Result<Awaited<ReturnType<typeof expense.getById>>>> => {
    const isMember = await tab.isMember(tabId, userId);
    if (!isMember) {
      return err("Not a member", 403);
    }
    const exp = await expense.getById(expenseId);
    if (!exp || exp.tabId !== tabId) {
      return err("Expense not found", 404);
    }
    return ok(exp);
  },

  getAuditLog: async (
    tabId: string,
    expenseId: string,
    userId: string,
  ): Promise<Result<Awaited<ReturnType<typeof expense.getAuditLog>>>> => {
    const isMember = await tab.isMember(tabId, userId);
    if (!isMember) {
      return err("Not a member", 403);
    }
    const exp = await expense.getById(expenseId);
    if (!exp || exp.tabId !== tabId) {
      return err("Expense not found", 404);
    }
    const auditLog = await expense.getAuditLog(expenseId);
    return ok(auditLog);
  },

  create: async (
    input: CreateExpenseInput,
    performedById: string,
  ): Promise<Result<CreateExpenseSuccess>> => {
    const isMember = await tab.isMember(input.tabId, performedById);
    if (!isMember) {
      return err("Not a member of this tab", 403);
    }

    const payerIsMember = await tab.isMember(input.tabId, input.paidById);
    if (!payerIsMember) {
      return err("Payer must be a member", 400);
    }

    const allMembers = await tab.getMembers(input.tabId);
    const participantIds =
      input.participantIds && input.participantIds.length > 0
        ? input.participantIds
        : allMembers.map((m) => m.userId);
    const members = allMembers.filter((m) => participantIds.includes(m.userId));

    if (members.length < 1) {
      return err("At least one person must be in the split", 400);
    }
    if (members.length === 1 && members[0]!.userId === input.paidById) {
      return err("Payer cannot be the only member of the split", 400);
    }

    const splits = calculateSplits(
      input.amount,
      members,
      input.splitType,
      input.splits,
    );
    if (!splits) {
      return err("Custom split requires splits array", 400);
    }

    const expenseId = await expense.create({
      tabId: input.tabId,
      paidById: input.paidById,
      amount: input.amount,
      description: input.description,
      splitType: input.splitType,
      expenseDate: input.expenseDate,
      splits,
      performedById,
    });

    const tabInfo = await tab.getTabInfoForNotifications(input.tabId, performedById);
    const fromUser = await userData.getById(performedById);
    const participantUserRows = await userData.getByIds(members.map((m) => m.userId));
    const participantMap = new Map(
      participantUserRows.map((r: { id: string; name: string | null; username: string | null }) => [
        r.id,
        { userId: r.id, name: r.name, username: r.username },
      ]),
    );
    const splitByUser = new Map(splits.map((s) => [s.userId, s.amount]));
    const participants = participantIds
      .map((id) => participantMap.get(id))
      .filter((p): p is { userId: string; name: string | null; username: string | null } => !!p)
      .map((p) => {
        const share = splitByUser.get(p.userId) ?? 0;
        const isPayer = p.userId === input.paidById;
        return {
          userId: p.userId,
          name: p.name ?? (p.username ? `@${p.username}` : null),
          paid: isPayer ? input.amount : undefined,
          owes: !isPayer ? share : undefined,
        };
      });

    if (tabInfo) {
      for (const m of members) {
        if (m.userId !== performedById) {
          await notificationService.publishExpenseAddedToUser(m.userId, {
            tabId: input.tabId,
            expenseId,
            tabName: tabInfo.name,
            isDirect: tabInfo.isDirect,
            fromUserId: performedById,
            fromUserName: fromUser?.name ?? null,
            description: input.description,
            amount: input.amount.toString(),
            recipientOweAmount: splitByUser.get(m.userId)?.toString(),
            createdAt: new Date(),
          });
        }
      }
    }

    return ok({
      expenseId,
      tabId: input.tabId,
      amount: input.amount,
      description: input.description,
      tabName: tabInfo?.displayName ?? "Tab",
      currency: tabInfo?.currency ?? "USD",
      participants,
    });
  },

  update: async (
    tabId: string,
    expenseId: string,
    input: Omit<CreateExpenseInput, "tabId">,
    performedById: string,
  ): Promise<Result<void>> => {
    const existingExp = await expense.getById(expenseId);
    if (!existingExp || existingExp.tabId !== tabId) {
      return err("Expense not found", 404);
    }
    if (existingExp.deletedAt) {
      return err("Cannot edit a deleted expense", 400);
    }

    const isMember = await tab.isMember(tabId, performedById);
    if (!isMember) {
      return err("Not a member", 403);
    }

    const payerIsMember = await tab.isMember(tabId, input.paidById);
    if (!payerIsMember) {
      return err("Payer must be a member", 400);
    }

    const allMembers = await tab.getMembers(tabId);
    const participantIds =
      input.participantIds && input.participantIds.length > 0
        ? input.participantIds
        : allMembers.map((m) => m.userId);
    const members = allMembers.filter((m) => participantIds.includes(m.userId));

    if (members.length < 1) {
      return err("At least one person must be in the split", 400);
    }
    if (members.length === 1 && members[0]!.userId === input.paidById) {
      return err("Payer cannot be the only member of the split", 400);
    }

    const splits = calculateSplits(
      input.amount,
      members,
      input.splitType,
      input.splits,
    );
    if (!splits) {
      return err("Custom split requires splits array", 400);
    }

    await expense.update(
      expenseId,
      tabId,
      {
        paidById: input.paidById,
        amount: input.amount,
        description: input.description,
        splitType: input.splitType,
        expenseDate: input.expenseDate,
        splits,
        performedById,
      },
      {
        amount: existingExp.amount.toString(),
        description: existingExp.description,
        paidById: existingExp.paidById,
        expenseDate: existingExp.expenseDate,
      },
      existingExp.splits.map((s) => ({ userId: s.userId, amount: String(s.amount) })),
    );

    const tabInfo = await tab.getTabInfoForNotifications(tabId, performedById);
    const fromUser = await userData.getById(performedById);
    const previousDescription = existingExp.description ?? "";
    const descriptionChanged =
      (input.description ?? previousDescription).trim() !== previousDescription.trim();
    const amountChanged = input.amount !== Number(existingExp.amount);

    if (tabInfo && fromUser) {
      for (const m of members) {
        if (m.userId !== performedById) {
          await notificationService.publishExpenseUpdatedToUser(m.userId, {
            tabId,
            expenseId,
            tabName: tabInfo.name,
            isDirect: tabInfo.isDirect,
            fromUserId: performedById,
            fromUserName: fromUser.name ?? null,
            description: input.description ?? "",
            amount: input.amount.toString(),
            recipientOweAmount: splits.find((s) => s.userId === m.userId)?.amount.toString(),
            descriptionChanged,
            amountChanged,
            previousDescription: existingExp.description ?? "",
            createdAt: new Date(),
          });
        }
      }
    }

    return ok(undefined);
  },

  delete: async (
    tabId: string,
    expenseId: string,
    userId: string,
  ): Promise<Result<void>> => {
    const exp = await expense.getById(expenseId);
    if (!exp || exp.tabId !== tabId) {
      return err("Expense not found", 404);
    }
    if (exp.deletedAt) {
      return err("Expense already deleted", 400);
    }

    const isMember = await tab.isMember(tabId, userId);
    if (!isMember) {
      return err("Not a member", 403);
    }

    await expense.delete(expenseId, tabId, userId);

    const tabInfo = await tab.getTabInfoForNotifications(tabId, userId);
    const fromUser = await userData.getById(userId);
    const deletedAt = new Date();
    const participantIds = [...new Set([exp.paidById, ...exp.splits.map((s) => s.userId)])];

    if (tabInfo && fromUser) {
      for (const participantId of participantIds) {
        if (participantId !== userId) {
          await notificationService.publishExpenseDeletedToUser(participantId, {
            tabId,
            expenseId,
            tabName: tabInfo.name,
            isDirect: tabInfo.isDirect,
            fromUserId: userId,
            fromUserName: fromUser.name ?? null,
            description: exp.description,
            amount: exp.amount.toString(),
            deletedAt,
            createdAt: deletedAt,
          });
        }
      }
    }

    return ok(undefined);
  },

  restore: async (
    tabId: string,
    expenseId: string,
    userId: string,
  ): Promise<Result<void>> => {
    const exp = await expense.getById(expenseId);
    if (!exp || exp.tabId !== tabId) {
      return err("Expense not found", 404);
    }
    if (!exp.deletedAt) {
      return err("Expense is not deleted", 400);
    }

    const isMember = await tab.isMember(tabId, userId);
    if (!isMember) {
      return err("Not a member", 403);
    }

    await expense.restore(expenseId, tabId, userId);

    const tabInfo = await tab.getTabInfoForNotifications(tabId, userId);
    const fromUser = await userData.getById(userId);
    const restoredAt = new Date();
    const participantIds = exp.splits.map((s) => s.userId);

    if (tabInfo && fromUser) {
      for (const participantId of participantIds) {
        if (participantId !== userId) {
          await notificationService.publishExpenseRestoredToUser(participantId, {
            tabId,
            expenseId,
            tabName: tabInfo.name,
            isDirect: tabInfo.isDirect,
            fromUserId: userId,
            fromUserName: fromUser.name ?? null,
            description: exp.description,
            amount: exp.amount.toString(),
            createdAt: restoredAt,
          });
        }
      }
    }

    return ok(undefined);
  },

  createBulk: async (
    tabId: string,
    rawExpenses: Array<Record<string, unknown>>,
    userId: string,
  ): Promise<
    Result<{
      imported: number;
      failed: number;
      errors?: string[];
    }>
  > => {
    const isMember = await tab.isMember(tabId, userId);
    if (!isMember) {
      return err("Not a member", 403);
    }

    if (rawExpenses.length === 0) {
      return err("No expenses to import", 400);
    }

    const allMembers = await tab.getMembers(tabId);
    const tabInfo = await tab.getTabInfoForNotifications(tabId, userId);
    const fromUser = await userData.getById(userId);

    const BATCH_SIZE = 500;
    const validated: Array<{
      tabId: string;
      paidById: string;
      amount: string;
      description: string;
      splitType: string;
      expenseDate: Date;
      splits: Array<{ userId: string; amount: string }>;
    }> = [];
    const errors: string[] = [];

    for (let i = 0; i < rawExpenses.length; i++) {
      const item = rawExpenses[i] as Record<string, unknown>;
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
      if (members.length === 1 && members[0]!.userId === parsed.data.paidById) {
        errors.push(`Row ${i + 1}: Payer cannot be the only member of the split`);
        continue;
      }

      const splits = calculateSplits(
        parsed.data.amount,
        members,
        parsed.data.splitType,
        parsed.data.splits,
      );
      if (!splits) {
        errors.push(`Row ${i + 1}: Custom split requires splits array`);
        continue;
      }

      validated.push({
        tabId: parsed.data.tabId,
        paidById: parsed.data.paidById,
        amount: parsed.data.amount.toString(),
        description: parsed.data.description,
        splitType: parsed.data.splitType,
        expenseDate: parsed.data.expenseDate,
        splits: splits.map((s) => ({ userId: s.userId, amount: s.amount.toString() })),
      });
    }

    let imported = 0;
    for (let b = 0; b < validated.length; b += BATCH_SIZE) {
      const batch = validated.slice(b, b + BATCH_SIZE);
      const startIndex = b;
      try {
        const items = batch.map((v) => ({
          tabId: v.tabId,
          paidById: v.paidById,
          amount: v.amount,
          description: v.description,
          splitType: v.splitType,
          expenseDate: v.expenseDate,
          splits: v.splits,
        }));
        await expense.createBulk(items, userId);
        imported += batch.length;
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        for (let i = 0; i < batch.length; i++) {
          errors.push(`Row ${startIndex + i + 1}: ${errMsg}`);
        }
      }
    }

    if (imported > 0 && tabInfo && fromUser) {
      for (const m of allMembers) {
        if (m.userId !== userId) {
          await notificationService.publishExpensesBulkImportedToUser(m.userId, {
            tabId,
            tabName: tabInfo.name,
            fromUserId: userId,
            fromUserName: fromUser.name ?? null,
            count: imported,
            createdAt: new Date(),
          });
        }
      }
    }

    return ok({
      imported,
      failed: rawExpenses.length - imported,
      errors: errors.length > 0 ? errors : undefined,
    });
  },

  addReaction: async (
    tabId: string,
    expenseId: string,
    emoji: string,
    userId: string,
  ): Promise<Result<void>> => {
    if (!emoji || typeof emoji !== "string") {
      return err("Invalid emoji", 400);
    }
    const trimmed = emoji.trim();
    if (trimmed.length === 0 || trimmed.length > 32) {
      return err("Invalid emoji", 400);
    }

    const isMember = await tab.isMember(tabId, userId);
    if (!isMember) {
      return err("Not a member", 403);
    }

    const exp = await expense.getById(expenseId);
    if (!exp || exp.tabId !== tabId) {
      return err("Expense not found", 404);
    }

    await expense.addOrUpdateReaction(expenseId, userId, trimmed);

    const tabInfo = await tab.getTabInfoForNotifications(tabId, userId);
    const fromUser = await userData.getById(userId);
    const participantIds = [
      exp.paidById,
      ...exp.splits.map((s) => s.userId),
    ].filter((id, i, arr) => arr.indexOf(id) === i && id !== userId);

    if (tabInfo && fromUser) {
      for (const participantId of participantIds) {
        await notificationService.publishExpenseReactionToUser(participantId, {
          tabId,
          expenseId,
          tabName: tabInfo.name,
          isDirect: tabInfo.isDirect,
          fromUserId: userId,
          fromUserName: fromUser.name ?? null,
          description: exp.description,
          amount: exp.amount.toString(),
          emoji: trimmed,
          createdAt: new Date(),
        });
      }
    }

    return ok(undefined);
  },

  removeReaction: async (
    tabId: string,
    expenseId: string,
    userId: string,
  ): Promise<Result<void>> => {
    const isMember = await tab.isMember(tabId, userId);
    if (!isMember) {
      return err("Not a member", 403);
    }

    const exp = await expense.getById(expenseId);
    if (!exp || exp.tabId !== tabId) {
      return err("Expense not found", 404);
    }

    await expense.removeReaction(expenseId, userId);
    return ok(undefined);
  },
};
