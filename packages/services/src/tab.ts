import { tab, settlement, user as userData } from "data";
import { CURRENCY_CODES } from "shared";
import { ok, err, type Result } from "./types.js";

export const tabService = {
  getTabsForUser: async (userId: string) => {
    const tabs = await tab.getTabsForUser(userId, {
      includeDirect: false,
      includeBalance: true,
      includeMemberIds: true,
      includeLastExpenseDate: true,
      includeExpenseCount: true,
    });
    return ok({ tabs });
  },

  getWithMembers: async (
    tabId: string,
    userId: string,
  ): Promise<Result<Awaited<ReturnType<typeof tab.getWithMembers>>>> => {
    const tabData = await tab.getWithMembers(tabId);
    if (!tabData) {
      return err("Tab not found", 404);
    }
    const isMember = tabData.members.some((m) => m.userId === userId);
    if (!isMember) {
      return err("Not a member", 403);
    }
    return ok(tabData);
  },

  getBalancesForTab: async (
    tabId: string,
    userId: string,
  ): Promise<Result<Awaited<ReturnType<typeof tab.getBalancesForTab>>>> => {
    const tabData = await tab.getWithMembers(tabId);
    if (!tabData) {
      return err("Tab not found", 404);
    }
    const isMember = tabData.members.some((m) => m.userId === userId);
    if (!isMember) {
      return err("Not a member", 403);
    }
    const balances = await tab.getBalancesForTab(tabId);
    return ok(balances);
  },

  getSettlementsForTab: async (
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

  create: async (
    name: string,
    userId: string,
    currency?: string,
  ): Promise<Result<{ tabId: string }>> => {
    let resolvedCurrency = currency?.trim();
    if (resolvedCurrency !== undefined && resolvedCurrency !== "") {
      if (!(CURRENCY_CODES as readonly string[]).includes(resolvedCurrency)) {
        return err("Invalid currency code", 400);
      }
    } else {
      resolvedCurrency = await userData.getDefaultCurrency(userId);
    }

    const id = await tab.create(name, userId, resolvedCurrency);
    return ok({ tabId: id });
  },

  update: async (
    tabId: string,
    userId: string,
    updates: { name?: string; currency?: string },
  ): Promise<Result<void>> => {
    const isMember = await tab.isMember(tabId, userId);
    if (!isMember) {
      return err("Not a member of this tab", 403);
    }

    const resolvedUpdates: { name?: string; currency?: string } = {};
    if (updates.name !== undefined) resolvedUpdates.name = updates.name.trim();
    if (updates.currency !== undefined) resolvedUpdates.currency = updates.currency.trim();

    if (Object.keys(resolvedUpdates).length === 0) {
      return err("Provide name or currency to update", 400);
    }

    const existingTab = await tab.getWithMembers(tabId);
    if (!existingTab) {
      return err("Tab not found", 404);
    }

    if (resolvedUpdates.name !== undefined && existingTab.isDirect) {
      return err("Direct tabs cannot be renamed", 400);
    }

    if (resolvedUpdates.currency !== undefined) {
      if (!(CURRENCY_CODES as readonly string[]).includes(resolvedUpdates.currency)) {
        return err("Invalid currency code", 400);
      }
    }

    await tab.update(tabId, resolvedUpdates);
    return ok(undefined);
  },

  addMember: async (
    tabId: string,
    userId: string,
    email: string,
    role?: string,
  ): Promise<Result<void>> => {
    const isMember = await tab.isMember(tabId, userId);
    if (!isMember) {
      return err("Not a member of this tab", 403);
    }

    const targetUser = await userData.getByEmail(email);
    if (!targetUser) {
      return err("User not found with that email", 404);
    }

    const existingMembers = await tab.getMembers(tabId);
    const alreadyMember = existingMembers.some((m) => m.userId === targetUser.id);
    if (alreadyMember) {
      return err("User is already a member", 400);
    }

    await tab.addMember(tabId, targetUser.id, role ?? "member");
    return ok(undefined);
  },

  removeMember: async (
    tabId: string,
    userId: string,
    targetUserId: string,
  ): Promise<Result<void>> => {
    if (targetUserId === userId) {
      return err("Use leave to remove yourself", 400);
    }

    const isMember = await tab.isMember(tabId, userId);
    if (!isMember) {
      return err("Not a member of this tab", 403);
    }

    const targetIsMember = await tab.isMember(tabId, targetUserId);
    if (!targetIsMember) {
      return err("User is not a member of this tab", 404);
    }

    await tab.removeMember(tabId, targetUserId);
    return ok(undefined);
  },
};
