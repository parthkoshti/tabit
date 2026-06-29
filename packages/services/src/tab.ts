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
    log("info", "Tab created", {
      operation: "tab.create",
      entityType: "tab",
      action: "create",
      tabId: id,
      performedById: userId,
      currency: resolvedCurrency,
      nameLength: name.trim().length,
    });
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
    log("info", "Tab updated", {
      operation: "tab.update",
      entityType: "tab",
      action: "update",
      tabId,
      performedById: userId,
      changedFields: Object.keys(resolvedUpdates),
      nameChanged:
        resolvedUpdates.name !== undefined && resolvedUpdates.name !== existingTab.name,
      nameLength: resolvedUpdates.name?.length,
      previousNameLength: existingTab.name.length,
      currency: resolvedUpdates.currency ?? existingTab.currency,
      previousCurrency: existingTab.currency,
      currencyChanged:
        resolvedUpdates.currency !== undefined &&
        resolvedUpdates.currency !== existingTab.currency,
      memberCount: existingTab.members.length,
      isDirect: existingTab.isDirect ?? false,
    });
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
    log("info", "Tab member added", {
      operation: "tab.member.add",
      entityType: "tab_member",
      action: "add",
      tabId,
      performedById: userId,
      targetUserId: targetUser.id,
      targetUsername: targetUser.username,
      role: role ?? "member",
      previousMemberCount: existingMembers.length,
      memberCount: existingMembers.length + 1,
    });
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

    const existingMembers = await tab.getMembers(tabId);
    await tab.removeMember(tabId, targetUserId);
    log("info", "Tab member removed", {
      operation: "tab.member.remove",
      entityType: "tab_member",
      action: "remove",
      tabId,
      performedById: userId,
      targetUserId,
      previousMemberCount: existingMembers.length,
      memberCount: Math.max(existingMembers.length - 1, 0),
    });
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
      log("info", "Placeholder participant created", {
        operation: "tab.placeholder.create",
        entityType: "tab_participant",
        action: "create",
        tabId,
        participantId,
        performedById: userId,
        displayNameLength: displayName.trim().length,
        memberCount: tabData.members.length,
        participantCount: tabData.participants.length + 1,
      });
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
      const previous = tabData.participants.find((p) => p.id === participantId);
      log("info", "Placeholder participant renamed", {
        operation: "tab.placeholder.rename",
        entityType: "tab_participant",
        action: "rename",
        tabId,
        participantId,
        performedById: userId,
        displayNameLength: displayName.trim().length,
        previousDisplayNameLength: previous?.displayName.length,
        displayNameChanged: previous?.displayName !== displayName,
      });
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
      log("info", "Placeholder participant merged", {
        operation: "tab.placeholder.merge",
        entityType: "tab_participant",
        action: "merge",
        tabId,
        placeholderParticipantId,
        targetUserId,
        performedById: userId,
        affectedExpenseCount: result.affectedExpenseIds.length,
        affectedExpenseIds: result.affectedExpenseIds,
        placeholderDisplayNameLength: result.placeholderDisplayName.length,
        targetDisplayNameLength: result.targetDisplayName.length,
      });
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
