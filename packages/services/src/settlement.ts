import { tab, settlement } from "data";
import { CURRENCY_CODES } from "shared";
import { convertToTabCurrency } from "./fx-rate.js";
import { ok, err, type Result } from "./types.js";

export const settlementService = {
  getForTab: async (
    tabId: string,
    userId: string,
  ): Promise<Result<Awaited<ReturnType<typeof settlement.getForTab>>>> => {
    const tabData = await tab.getWithMembers(tabId);
    if (!tabData) {
      return err("Tab not found", 404);
    }
    const isMember = tabData.members.some((m) => m.userId === userId);
    if (!isMember) {
      return err("Not a member", 403);
    }
    const settlements = await settlement.getForTab(tabId);
    return ok(settlements);
  },

  getById: async (
    tabId: string,
    settlementId: string,
    userId: string,
  ): Promise<Result<Awaited<ReturnType<typeof settlement.getById>>>> => {
    const tabData = await tab.getWithMembers(tabId);
    if (!tabData) {
      return err("Tab not found", 404);
    }
    const isMember = tabData.members.some((m) => m.userId === userId);
    if (!isMember) {
      return err("Not a member", 403);
    }
    const s = await settlement.getById(settlementId);
    if (!s || s.tabId !== tabId) {
      return err("Settlement not found", 404);
    }
    return ok(s);
  },

  getAuditLog: async (
    tabId: string,
    settlementId: string,
    userId: string,
  ): Promise<Result<Awaited<ReturnType<typeof settlement.getAuditLog>>>> => {
    const tabData = await tab.getWithMembers(tabId);
    if (!tabData) {
      return err("Tab not found", 404);
    }
    const isMember = tabData.members.some((m) => m.userId === userId);
    if (!isMember) {
      return err("Not a member", 403);
    }
    const s = await settlement.getById(settlementId);
    if (!s || s.tabId !== tabId) {
      return err("Settlement not found", 404);
    }
    const auditLog = await settlement.getAuditLog(settlementId);
    return ok(auditLog);
  },

  record: async (
    tabId: string,
    fromUserId: string,
    toUserId: string,
    amount: number,
    performedById: string,
    currency?: string | null,
    originalAmount?: number | null,
    settlementDate?: Date | null,
  ): Promise<Result<void>> => {
    const isMember = await tab.isMember(tabId, performedById);
    if (!isMember) {
      return err("Not a member", 403);
    }

    const fromIsMember = await tab.isMember(tabId, fromUserId);
    const toIsMember = await tab.isMember(tabId, toUserId);
    if (!fromIsMember || !toIsMember) {
      return err("Both payer and payee must be tab members", 400);
    }

    if (fromUserId === toUserId) {
      return err("Payer and payee must be different people", 400);
    }

    const tabCurrency = (await tab.getCurrency(tabId)) ?? "USD";
    const settlementCurrency = (currency?.trim() || tabCurrency).toUpperCase();
    if (!(CURRENCY_CODES as readonly string[]).includes(settlementCurrency)) {
      return err("Invalid currency code", 400);
    }

    const enteredAmount = originalAmount ?? amount;
    const asOfDate = settlementDate ?? new Date();
    let amountTab: number;
    let storedCurrency: string | null = null;
    let storedOriginal: number | null = null;

    if (settlementCurrency === tabCurrency) {
      amountTab = enteredAmount;
    } else {
      const conv = await convertToTabCurrency({
        originalAmount: enteredAmount,
        from: settlementCurrency,
        tabCurrency,
        asOfDate,
      });
      if (!conv.success) {
        return conv;
      }
      amountTab = conv.data.amountTab;
      storedCurrency = settlementCurrency;
      storedOriginal = enteredAmount;
    }

    await settlement.record({
      tabId,
      fromUserId,
      toUserId,
      amount: amountTab,
      currency: storedCurrency,
      originalAmount: storedOriginal,
      settlementDate: asOfDate,
      performedById,
    });
    return ok(undefined);
  },

  update: async (
    tabId: string,
    settlementId: string,
    fromUserId: string,
    toUserId: string,
    amount: number,
    performedById: string,
    currency?: string | null,
    originalAmount?: number | null,
    settlementDate?: Date | null,
  ): Promise<Result<void>> => {
    const existing = await settlement.getById(settlementId);
    if (!existing || existing.tabId !== tabId) {
      return err("Settlement not found", 404);
    }

    const isMember = await tab.isMember(tabId, performedById);
    if (!isMember) {
      return err("Not a member", 403);
    }

    const fromIsMember = await tab.isMember(tabId, fromUserId);
    const toIsMember = await tab.isMember(tabId, toUserId);
    if (!fromIsMember || !toIsMember) {
      return err("Both payer and payee must be tab members", 400);
    }

    if (fromUserId === toUserId) {
      return err("Payer and payee must be different people", 400);
    }

    const tabCurrency = (await tab.getCurrency(tabId)) ?? "USD";
    const settlementCurrency = (currency?.trim() || tabCurrency).toUpperCase();
    if (!(CURRENCY_CODES as readonly string[]).includes(settlementCurrency)) {
      return err("Invalid currency code", 400);
    }

    const enteredAmount = originalAmount ?? amount;
    const asOfDate = settlementDate ?? existing.settlementDate;
    let amountTab: number;
    let storedCurrency: string | null = null;
    let storedOriginal: number | null = null;

    if (settlementCurrency === tabCurrency) {
      amountTab = enteredAmount;
    } else {
      const conv = await convertToTabCurrency({
        originalAmount: enteredAmount,
        from: settlementCurrency,
        tabCurrency,
        asOfDate,
      });
      if (!conv.success) {
        return conv;
      }
      amountTab = conv.data.amountTab;
      storedCurrency = settlementCurrency;
      storedOriginal = enteredAmount;
    }

    await settlement.update(settlementId, tabId, {
      fromUserId,
      toUserId,
      amount: amountTab,
      currency: storedCurrency,
      originalAmount: storedOriginal,
      settlementDate: asOfDate,
      performedById,
    });
    return ok(undefined);
  },

  delete: async (
    tabId: string,
    settlementId: string,
    userId: string,
  ): Promise<Result<void>> => {
    const s = await settlement.getById(settlementId);
    if (!s || s.tabId !== tabId) {
      return err("Settlement not found", 404);
    }

    const isMember = await tab.isMember(tabId, userId);
    if (!isMember) {
      return err("Not a member", 403);
    }

    await settlement.delete(settlementId, tabId, userId);
    return ok(undefined);
  },
};
