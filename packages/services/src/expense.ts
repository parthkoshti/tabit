import { expense, tab, user as userData } from "data";
import type { GetExpensesForTabOptions } from "data";
import { createExpenseSchema } from "models";
import { CURRENCY_CODES, getCurrency } from "shared";
import { ok, err, type Result } from "./types.js";
import { notificationService } from "./notification.js";
import { convertToTabCurrency } from "./fx-rate.js";

function roundTo2(n: number): number {
  return Math.round(n * 100) / 100;
}

type ResolvedSplitRow = {
  userId: string;
  amount: number;
  /** Stored for percent/shares; null for equal/custom. */
  weight: number | null;
};

function orderMembersByParticipantIds(
  allMembers: Array<{ userId: string }>,
  participantIds: string[],
): Array<{ userId: string }> {
  const map = new Map(allMembers.map((m) => [m.userId, m]));
  const ordered: Array<{ userId: string }> = [];
  for (const id of participantIds) {
    const m = map.get(id);
    if (m) ordered.push({ userId: m.userId });
  }
  return ordered;
}

function buildSplitInputMap(
  members: Array<{ userId: string }>,
  inputSplits: Array<{ userId: string; amount?: number; weight?: number }> | undefined,
): Map<string, { amount?: number; weight?: number }> | null {
  if (!inputSplits || inputSplits.length !== members.length) return null;
  const map = new Map(inputSplits.map((s) => [s.userId, s]));
  if (map.size !== inputSplits.length) return null;
  for (const m of members) {
    if (!map.has(m.userId)) return null;
  }
  return map;
}

function calculateSplits(
  amountTab: number,
  members: Array<{ userId: string }>,
  splitType: string,
  inputSplits?: Array<{ userId: string; amount?: number; weight?: number }>,
): { splits: ResolvedSplitRow[] } | { error: string } {
  if (members.length < 1) return { error: "Invalid split" };

  if (splitType === "equal") {
    if (members.length === 1) {
      return {
        splits: [{ userId: members[0]!.userId, amount: roundTo2(amountTab), weight: null }],
      };
    }
    const perPerson = Math.floor((amountTab / members.length) * 100) / 100;
    const remainder = roundTo2(amountTab - perPerson * (members.length - 1));
    return {
      splits: members.map((m, i) => ({
        userId: m.userId,
        amount: i === members.length - 1 ? remainder : perPerson,
        weight: null,
      })),
    };
  }

  const splitMap = buildSplitInputMap(members, inputSplits);
  if (!splitMap) {
    return {
      error:
        splitType === "custom"
          ? "Custom split requires one entry per participant with amounts"
          : splitType === "percent"
            ? "Percent split requires one entry per participant with weights"
            : splitType === "shares"
              ? "Shares split requires one entry per participant with weights"
              : "Invalid split",
    };
  }

  if (splitType === "custom") {
    let sum = 0;
    const rows: ResolvedSplitRow[] = [];
    for (const m of members) {
      const line = splitMap.get(m.userId)!;
      if (line.amount === undefined) {
        return { error: "Custom split requires an amount for each participant" };
      }
      if (line.amount <= 0) {
        return { error: "Each participant must have a positive split amount" };
      }
      sum += line.amount;
      rows.push({ userId: m.userId, amount: roundTo2(line.amount), weight: null });
    }
    if (Math.abs(roundTo2(sum) - roundTo2(amountTab)) > 0.01) {
      return { error: "Custom split amounts must sum to the expense total" };
    }
    return { splits: rows };
  }

  if (splitType === "percent") {
    let weightSum = 0;
    const weights: number[] = [];
    for (const m of members) {
      const w = splitMap.get(m.userId)!.weight;
      if (w === undefined) {
        return { error: "Percent split requires a weight for each participant" };
      }
      weightSum += w;
      weights.push(w);
    }
    if (Math.abs(weightSum - 100) > 0.01) {
      return { error: "Percentages must sum to 100" };
    }

    if (members.length === 1) {
      return {
        splits: [
          {
            userId: members[0]!.userId,
            amount: roundTo2(amountTab),
            weight: weights[0]!,
          },
        ],
      };
    }

    const amounts: number[] = [];
    for (let i = 0; i < members.length - 1; i++) {
      amounts.push(roundTo2((weights[i]! / 100) * amountTab));
    }
    const allocated = amounts.reduce((a, b) => a + b, 0);
    amounts.push(roundTo2(amountTab - allocated));

    return {
      splits: members.map((m, i) => ({
        userId: m.userId,
        amount: amounts[i]!,
        weight: weights[i]!,
      })),
    };
  }

  if (splitType === "shares") {
    let totalShares = 0;
    const weights: number[] = [];
    for (const m of members) {
      const w = splitMap.get(m.userId)!.weight;
      if (w === undefined) {
        return { error: "Shares split requires a weight for each participant" };
      }
      if (!Number.isInteger(w) || w < 1) {
        return { error: "Share counts must be positive integers" };
      }
      totalShares += w;
      weights.push(w);
    }

    if (members.length === 1) {
      return {
        splits: [
          {
            userId: members[0]!.userId,
            amount: roundTo2(amountTab),
            weight: weights[0]!,
          },
        ],
      };
    }

    const amounts: number[] = [];
    for (let i = 0; i < members.length - 1; i++) {
      amounts.push(roundTo2((weights[i]! / totalShares) * amountTab));
    }
    const allocated = amounts.reduce((a, b) => a + b, 0);
    amounts.push(roundTo2(amountTab - allocated));

    return {
      splits: members.map((m, i) => ({
        userId: m.userId,
        amount: amounts[i]!,
        weight: weights[i]!,
      })),
    };
  }

  return { error: "Invalid split" };
}

export type CreateExpenseInput = {
  tabId: string;
  paidById: string;
  /** Amount in `currency` (defaults to tab currency). */
  amount: number;
  currency?: string;
  description: string;
  splitType: "equal" | "custom" | "percent" | "shares";
  expenseDate: Date;
  participantIds?: string[];
  splits?: Array<{ userId: string; amount?: number; weight?: number }>;
};

export type CreateExpenseSuccess = {
  expenseId: string;
  tabId: string;
  /** Tab-currency total (splits). */
  amount: number;
  description: string;
  tabName: string;
  /** Tab ISO code (format split amounts). */
  currency: string;
  expenseCurrency: string;
  originalAmount: number;
  fxRateDate?: string;
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
    const useExplicitParticipants =
      input.participantIds && input.participantIds.length > 0;
    const members = useExplicitParticipants
      ? orderMembersByParticipantIds(allMembers, participantIds)
      : allMembers.map((m) => ({ userId: m.userId }));

    if (members.length < 1) {
      return err("At least one person must be in the split", 400);
    }
    if (members.length === 1 && members[0]!.userId === input.paidById) {
      return err("Payer cannot be the only member of the split", 400);
    }

    const tabCurrency = (await tab.getCurrency(input.tabId)) ?? "USD";
    const expenseCurrency = (input.currency?.trim() || tabCurrency).toUpperCase();
    if (!(CURRENCY_CODES as readonly string[]).includes(expenseCurrency)) {
      return err("Invalid currency code", 400);
    }

    const conv = await convertToTabCurrency({
      originalAmount: input.amount,
      from: expenseCurrency,
      tabCurrency,
      asOfDate: input.expenseDate,
    });
    if (!conv.success) {
      return conv;
    }
    const amountTab = conv.data.amountTab;

    const splitResult = calculateSplits(amountTab, members, input.splitType, input.splits);
    if ("error" in splitResult) {
      return err(splitResult.error, 400);
    }
    const splits = splitResult.splits;

    const expenseId = await expense.create({
      tabId: input.tabId,
      paidById: input.paidById,
      amount: amountTab,
      currency: expenseCurrency,
      originalAmount: input.amount,
      description: input.description,
      splitType: input.splitType,
      expenseDate: input.expenseDate,
      splits,
      performedById,
    });

    const tabInfo = await tab.getTabInfoForNotifications(input.tabId, performedById);
    const payerUser = await userData.getById(input.paidById);
    const payerDisplayName =
      payerUser?.name ?? (payerUser?.username ? `@${payerUser.username}` : null);
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
          paid: isPayer ? amountTab : undefined,
          owes: !isPayer ? share : undefined,
        };
      });

    const notifyAmount =
      expenseCurrency !== tabCurrency
        ? `${input.amount} ${expenseCurrency} (${amountTab} ${tabCurrency})`
        : String(amountTab);
    const currencySymbol = getCurrency(tabCurrency)?.symbol ?? "$";

    if (tabInfo) {
      for (const m of members) {
        if (m.userId !== performedById) {
          await notificationService.publishExpenseAddedToUser(m.userId, {
            tabId: input.tabId,
            expenseId,
            tabName: tabInfo.name,
            isDirect: tabInfo.isDirect,
            fromUserId: input.paidById,
            fromUserName: payerDisplayName,
            description: input.description,
            amount: notifyAmount,
            recipientOweAmount: splitByUser.get(m.userId)?.toString(),
            currencySymbol,
            createdAt: new Date(),
          });
        }
      }
    }

    return ok({
      expenseId,
      tabId: input.tabId,
      amount: amountTab,
      description: input.description,
      tabName: tabInfo?.displayName ?? "Tab",
      currency: tabCurrency,
      expenseCurrency,
      originalAmount: input.amount,
      fxRateDate:
        expenseCurrency !== tabCurrency ? conv.data.rateDate : undefined,
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
    const useExplicitParticipants =
      input.participantIds && input.participantIds.length > 0;
    const members = useExplicitParticipants
      ? orderMembersByParticipantIds(allMembers, participantIds)
      : allMembers.map((m) => ({ userId: m.userId }));

    if (members.length < 1) {
      return err("At least one person must be in the split", 400);
    }
    if (members.length === 1 && members[0]!.userId === input.paidById) {
      return err("Payer cannot be the only member of the split", 400);
    }

    const tabCurrency = (await tab.getCurrency(tabId)) ?? "USD";
    const expenseCurrency = (input.currency?.trim() || tabCurrency).toUpperCase();
    if (!(CURRENCY_CODES as readonly string[]).includes(expenseCurrency)) {
      return err("Invalid currency code", 400);
    }

    const conv = await convertToTabCurrency({
      originalAmount: input.amount,
      from: expenseCurrency,
      tabCurrency,
      asOfDate: input.expenseDate,
    });
    if (!conv.success) {
      return conv;
    }
    const amountTab = conv.data.amountTab;

    const splitResult = calculateSplits(amountTab, members, input.splitType, input.splits);
    if ("error" in splitResult) {
      return err(splitResult.error, 400);
    }
    const splits = splitResult.splits;

    await expense.update(
      expenseId,
      tabId,
      {
        paidById: input.paidById,
        amount: amountTab,
        currency: expenseCurrency,
        originalAmount: input.amount,
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
        currency: existingExp.currency,
        originalAmount: existingExp.originalAmount.toString(),
      },
      existingExp.splits.map((s) => ({
        userId: s.userId,
        amount: String(s.amount),
        weight: s.weight != null ? String(s.weight) : undefined,
      })),
    );

    const tabInfo = await tab.getTabInfoForNotifications(tabId, performedById);
    const fromUser = await userData.getById(performedById);
    const previousDescription = existingExp.description ?? "";
    const descriptionChanged =
      (input.description ?? previousDescription).trim() !== previousDescription.trim();
    const amountChanged = amountTab !== Number(existingExp.amount);

    const notifyAmount =
      expenseCurrency !== tabCurrency
        ? `${input.amount} ${expenseCurrency} (${amountTab} ${tabCurrency})`
        : String(amountTab);
    const currencySymbol = getCurrency(tabCurrency)?.symbol ?? "$";

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
            amount: notifyAmount,
            recipientOweAmount: splits.find((s) => s.userId === m.userId)?.amount.toString(),
            currencySymbol,
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
    const tabCurrency = (await tab.getCurrency(tabId)) ?? "USD";
    const currencySymbol = getCurrency(tabCurrency)?.symbol ?? "$";
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
            currencySymbol,
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
    const tabCurrency = (await tab.getCurrency(tabId)) ?? "USD";
    const currencySymbol = getCurrency(tabCurrency)?.symbol ?? "$";
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
            currencySymbol,
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
    const tabCurrency = (await tab.getCurrency(tabId)) ?? "USD";

    const BATCH_SIZE = 500;
    const validated: Array<{
      tabId: string;
      paidById: string;
      amount: string;
      currency: string;
      originalAmount: string;
      description: string;
      splitType: string;
      expenseDate: Date;
      splits: Array<{ userId: string; amount: string; weight?: string }>;
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
      const useExplicit =
        Array.isArray(item.participantIds) && item.participantIds.length > 0;
      const members = useExplicit
        ? orderMembersByParticipantIds(allMembers, participantIds)
        : allMembers.map((m) => ({ userId: m.userId }));

      if (members.length < 1) {
        errors.push(`Row ${i + 1}: At least one person must be in the split`);
        continue;
      }
      if (members.length === 1 && members[0]!.userId === parsed.data.paidById) {
        errors.push(`Row ${i + 1}: Payer cannot be the only member of the split`);
        continue;
      }

      const rowCurrency =
        (typeof item.currency === "string" && item.currency.trim()) ||
        parsed.data.currency?.trim() ||
        tabCurrency;
      const expenseCurrency = rowCurrency.toUpperCase();
      if (!(CURRENCY_CODES as readonly string[]).includes(expenseCurrency)) {
        errors.push(`Row ${i + 1}: Invalid currency code`);
        continue;
      }

      const conv = await convertToTabCurrency({
        originalAmount: parsed.data.amount,
        from: expenseCurrency,
        tabCurrency,
        asOfDate: parsed.data.expenseDate,
      });
      if (!conv.success) {
        errors.push(`Row ${i + 1}: ${conv.error}`);
        continue;
      }
      const amountTab = conv.data.amountTab;

      const splitResult = calculateSplits(
        amountTab,
        members,
        parsed.data.splitType,
        parsed.data.splits,
      );
      if ("error" in splitResult) {
        errors.push(`Row ${i + 1}: ${splitResult.error}`);
        continue;
      }
      const splits = splitResult.splits;

      validated.push({
        tabId: parsed.data.tabId,
        paidById: parsed.data.paidById,
        amount: amountTab.toString(),
        currency: expenseCurrency,
        originalAmount: parsed.data.amount.toString(),
        description: parsed.data.description,
        splitType: parsed.data.splitType,
        expenseDate: parsed.data.expenseDate,
        splits: splits.map((s) => ({
          userId: s.userId,
          amount: s.amount.toString(),
          weight: s.weight != null ? s.weight.toString() : undefined,
        })),
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
          currency: v.currency,
          originalAmount: v.originalAmount,
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
