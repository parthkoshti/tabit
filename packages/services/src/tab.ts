import {
  tab,
  settlement,
  user as userData,
  createPlaceholderParticipant,
  renamePlaceholderParticipant,
  mergePlaceholderIntoMember,
} from "data";
import { CURRENCY_CODES } from "shared";
import { log } from "otel";
import { ok, err, type Result } from "./types.js";
import { notificationService } from "./notification.js";

function displayUserLabel(u: {
  name: string | null;
  email: string;
  username?: string | null;
}): string {
  return (
    u.name?.trim() ||
    (u.username ? `@${u.username}` : null) ||
    u.email ||
    "Someone"
  );
}

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

  /** Group tabs (non-direct) where the current user and the other person in a direct tab are both members. */
  getSharedGroupTabsForDirectTab: async (
    tabId: string,
    userId: string,
  ): Promise<
    Result<Awaited<ReturnType<typeof tab.listGroupTabsSharedBetweenUsers>>>
  > => {
    const tabData = await tab.getWithMembers(tabId);
    if (!tabData) {
      return err("Tab not found", 404);
    }
    const isMember = tabData.members.some((m) => m.userId === userId);
    if (!isMember) {
      return err("Not a member", 403);
    }
    if (!tabData.isDirect) {
      return ok([]);
    }
    const other = tabData.members.find((m) => m.userId !== userId);
    if (!other) {
      return ok([]);
    }
    const rows = await tab.listGroupTabsSharedBetweenUsers(
      userId,
      other.userId,
    );
    return ok(rows);
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
    log("info", "Tab created", { tabId: id, userId, currency: resolvedCurrency });
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
    log("info", "Tab updated", { tabId, userId, updates: resolvedUpdates });
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
    log("info", "Tab member added", { tabId, addedUserId: targetUser.id, addedByUserId: userId, role: role ?? "member" });
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
    log("info", "Tab member removed", { tabId, removedUserId: targetUserId, removedByUserId: userId });
    return ok(undefined);
  },

  createPlaceholder: async (
    tabId: string,
    userId: string,
    displayName: string,
  ): Promise<Result<{ participantId: string }>> => {
    const tabData = await tab.getWithMembers(tabId);
    if (!tabData) {
      return err("Tab not found", 404);
    }
    const isMember = tabData.members.some((m) => m.userId === userId);
    if (!isMember) {
      return err("Not a member", 403);
    }
    try {
      const participantId = await createPlaceholderParticipant({
        tabId,
        displayName,
        createdByUserId: userId,
      });
      log("info", "Placeholder participant created", { tabId, participantId, displayName, createdByUserId: userId });
      return ok({ participantId });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create placeholder";
      return err(msg, 400);
    }
  },

  renamePlaceholder: async (
    tabId: string,
    participantId: string,
    userId: string,
    displayName: string,
  ): Promise<Result<void>> => {
    const tabData = await tab.getWithMembers(tabId);
    if (!tabData) {
      return err("Tab not found", 404);
    }
    const isMember = tabData.members.some((m) => m.userId === userId);
    if (!isMember) {
      return err("Not a member", 403);
    }
    try {
      await renamePlaceholderParticipant({
        tabId,
        participantId,
        displayName,
      });
      log("info", "Placeholder participant renamed", { tabId, participantId, displayName, userId });
      return ok(undefined);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to rename placeholder";
      if (msg.includes("not found")) return err(msg, 404);
      return err(msg, 400);
    }
  },

  mergePlaceholder: async (
    tabId: string,
    placeholderParticipantId: string,
    userId: string,
    targetUserId: string,
  ): Promise<Result<Awaited<ReturnType<typeof mergePlaceholderIntoMember>>>> => {
    const tabData = await tab.getWithMembers(tabId);
    if (!tabData) {
      return err("Tab not found", 404);
    }
    const requester = tabData.members.find((m) => m.userId === userId);
    if (!requester) {
      return err("Not a member", 403);
    }
    if (requester.role !== "owner") {
      return err("Only tab owners can merge placeholders", 403);
    }
    const targetIsMember = tabData.members.some((m) => m.userId === targetUserId);
    if (!targetIsMember) {
      return err("Target is not a tab member", 400);
    }
    try {
      const result = await mergePlaceholderIntoMember({
        tabId,
        placeholderParticipantId,
        targetUserId,
        performedByUserId: userId,
      });
      log("info", "Placeholder participant merged", { tabId, placeholderParticipantId, targetUserId, performedByUserId: userId });
      if (targetUserId !== userId) {
        const actor = await userData.getById(userId);
        const actorName = actor
          ? displayUserLabel({
              name: actor.name,
              email: actor.email,
              username: actor.username,
            })
          : "Someone";
        await notificationService.publishPlaceholderMergedToUser(targetUserId, {
          tabId,
          tabName: result.tabName,
          fromUserId: userId,
          fromUserName: actorName,
          placeholderDisplayName: result.placeholderDisplayName,
          targetDisplayName: result.targetDisplayName,
          createdAt: new Date(),
        });
      }
      return ok(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Merge failed";
      if (msg.includes("not found")) return err(msg, 404);
      return err(msg, 400);
    }
  },
};
