import { tab, settlement } from "data";
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

    await settlement.record({
      tabId,
      fromUserId,
      toUserId,
      amount,
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

    await settlement.update(settlementId, tabId, {
      fromUserId,
      toUserId,
      amount,
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
