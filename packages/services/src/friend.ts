import { createShortId, formatAmount } from "shared";
import type { PaymentReminderTone } from "models";
import { tab, friend as friendData, user as userData } from "data";
import { log } from "otel";
import { ok, err, type Result } from "./types.js";
import { notificationService } from "./notification.js";

function secureToken(): string {
  return createShortId();
}

export const friendService = {
  getPendingRequests: async (userId: string) => {
    const requests = await friendData.getPendingRequests(userId);
    return ok({
      requests: requests.map((r) => ({
        id: r.id,
        fromUserId: r.fromUserId,
        fromUserUsername: r.fromUserUsername,
        fromUserName: r.fromUserName,
        createdAt: r.createdAt,
      })),
    });
  },

  sendRequest: async (
    userId: string,
    username: string,
  ): Promise<Result<void>> => {
    const trimmed = username.trim();
    if (!trimmed) {
      return err("Username is required", 400);
    }

    const targetUser = await userData.getByUsername(trimmed);
    if (!targetUser) {
      return err("User not found", 404);
    }

    if (targetUser.id === userId) {
      return err("You cannot add yourself", 400);
    }

    const existingDirectTab = await friendData.getDirectTabBetween(userId, targetUser.id);
    if (existingDirectTab) {
      return err("You are already friends with this person", 400);
    }

    const hasExistingRequest = await friendData.checkExistingRequest(userId, targetUser.id);
    if (hasExistingRequest) {
      return err("Friend request already sent", 400);
    }

    const hasReverseRequest = await friendData.checkReverseRequest(targetUser.id, userId);
    if (hasReverseRequest) {
      return err(
        "You have a pending request from this person - accept it from your friend requests",
        400,
      );
    }

    const { id: requestId, createdAt } = await friendData.createRequest(userId, targetUser.id);
    const sender = await userData.getById(userId);

    await notificationService.publishFriendRequest({
      userId: targetUser.id,
      requestId,
      fromUserId: userId,
      fromUserName: sender?.name ?? null,
      fromUserUsername: sender?.username ?? null,
      createdAt,
    });

    log("info", "Friend request sent", { requestId, fromUserId: userId, toUserId: targetUser.id });
    return ok(undefined);
  },

  acceptRequest: async (
    requestId: string,
    userId: string,
  ): Promise<Result<{ friendTabId: string }>> => {
    const req = await friendData.getRequestByIdAndToUser(requestId, userId);
    if (!req) {
      return err("Request not found or already handled", 404);
    }

    await friendData.updateRequestStatus(requestId, "accepted");
    const currency = await userData.getDefaultCurrency(userId);
    const friendTabId = await tab.createDirect(userId, req.fromUserId, currency);

    const accepter = await userData.getById(userId);
    await notificationService.publishFriendRequestAccepted({
      userId: req.fromUserId,
      requestId,
      friendTabId,
      fromUserId: userId,
      fromUserName: accepter?.name ?? null,
      fromUserUsername: accepter?.username ?? null,
      createdAt: new Date(),
    });

    log("info", "Friend request accepted", { requestId, userId, fromUserId: req.fromUserId, friendTabId });
    return ok({ friendTabId });
  },

  rejectRequest: async (
    requestId: string,
    userId: string,
  ): Promise<Result<void>> => {
    await friendData.updateRequestStatusForToUser(requestId, userId, "rejected");
    log("info", "Friend request rejected", { requestId, userId });
    return ok(undefined);
  },

  getInviteToken: async (
    userId: string,
  ): Promise<Result<{ token: string; url: string }>> => {
    const sessionUser = await userData.getById(userId);
    const username = sessionUser?.username;
    if (!username) {
      return err("Set a username first", 400);
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const existing = await friendData.getPendingFriendByUser(userId);
    let token: string;

    if (existing && existing.token.length <= 8) {
      token = existing.token;
    } else {
      if (existing) {
        await friendData.deletePendingFriend(existing.id);
      }
      token = secureToken();
      for (let i = 0; i < 5; i++) {
        try {
          await friendData.createPendingFriend(token, userId, expiresAt);
          break;
        } catch {
          token = secureToken();
          if (i === 4) throw new Error("Failed to generate invite token");
        }
      }
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_PWA_URL ??
      process.env.NEXT_PUBLIC_WEB_URL ??
      process.env.APP_URL ??
      "http://localhost:3003";
    const url = `${baseUrl}/invite?user=${encodeURIComponent(username)}&qr=${encodeURIComponent(token)}`;

    return ok({ token, url });
  },

  addByToken: async (
    userId: string,
    token: string,
  ): Promise<Result<{ friendTabId: string; alreadyFriends?: boolean }>> => {
    const trimmed = token?.trim();
    if (!trimmed) {
      return err("Invalid token", 400);
    }

    const pending = await friendData.getPendingFriendByToken(trimmed);
    if (!pending) {
      return err("Invalid or expired link", 400);
    }

    if (pending.userId === userId) {
      return err("You cannot add yourself", 400);
    }

    const existingDirectTab = await friendData.getDirectTabBetween(userId, pending.userId);
    if (existingDirectTab) {
      await friendData.deletePendingFriend(pending.id);
      return ok({ friendTabId: existingDirectTab, alreadyFriends: true });
    }

    const currency = await userData.getDefaultCurrency(userId);
    const friendTabId = await tab.createDirect(userId, pending.userId, currency);
    await friendData.deletePendingFriend(pending.id);

    log("info", "Friend added by token", { userId, friendUserId: pending.userId, friendTabId });
    return ok({ friendTabId });
  },

  searchUsers: async (
    userId: string,
    query: string,
    includeFriends: boolean,
  ): Promise<Result<Array<{ id: string; username: string | null; name: string | null }>>> => {
    const trimmed = query.trim().toLowerCase();
    if (trimmed.length < 3) {
      return ok([]);
    }

    let excludeUserIds = [userId];
    if (!includeFriends) {
      const tabIds = await friendData.getDirectTabIdsForUser(userId);
      for (const tabId of tabIds) {
        const other = await friendData.getOtherMemberOfDirectTab(tabId, userId);
        if (other) excludeUserIds.push(other);
      }
    }

    const users = await friendData.searchUsers(trimmed, [...new Set(excludeUserIds)], 10);
    const filtered = users.filter((u) => u.id !== userId);
    return ok(filtered);
  },

  getFriends: async (userId: string) => {
    const friends = await tab.getDirectTabsForUser(userId);
    return ok({ friends });
  },

  poke: async (
    userId: string,
    friendTabId: string,
  ): Promise<Result<void>> => {
    const trimmed = friendTabId.trim();
    if (!trimmed) {
      return err("friendTabId is required", 400);
    }

    const isInTab = await friendData.isUserInDirectTab(trimmed, userId);
    if (!isInTab) {
      return err("Tab not found or you are not a member", 404);
    }

    const friendUserId = await friendData.getOtherMemberOfDirectTab(trimmed, userId);
    if (!friendUserId) {
      return err("Friend not found", 404);
    }

    const sender = await userData.getById(userId);
    await notificationService.publishPoke({
      userId: friendUserId,
      friendTabId: trimmed,
      fromUserId: userId,
      fromUserName: sender?.name ?? null,
      fromUserUsername: sender?.username ?? null,
      createdAt: new Date(),
    });

    log("info", "Poke sent", { fromUserId: userId, toUserId: friendUserId, friendTabId: trimmed });
    return ok(undefined);
  },

  sendPaymentReminder: async (
    userId: string,
    friendTabId: string,
    tone: PaymentReminderTone,
  ): Promise<Result<void>> => {
    const trimmed = friendTabId.trim();
    if (!trimmed) {
      return err("friendTabId is required", 400);
    }

    const isInTab = await friendData.isUserInDirectTab(trimmed, userId);
    if (!isInTab) {
      return err("Tab not found or you are not a member", 404);
    }

    const tabData = await tab.getWithMembers(trimmed);
    if (!tabData?.isDirect) {
      return err("Only direct tabs support payment reminders", 400);
    }

    const friendUserId = await friendData.getOtherMemberOfDirectTab(
      trimmed,
      userId,
    );
    if (!friendUserId) {
      return err("Friend not found", 404);
    }

    const balances = await tab.getBalancesForTab(trimmed);
    const mine = balances.find((b) => b.userId === userId);
    let myNet = mine?.amount ?? 0;
    if (mine === undefined && balances.length === 1) {
      const only = balances[0];
      if (only && only.userId !== userId) {
        myNet = -only.amount;
      }
    }
    if (myNet <= 0) {
      return err("You are not owed on this tab", 400);
    }

    const sender = await userData.getById(userId);
    const amountDisplay = formatAmount(myNet, tabData.currency ?? "USD");

    await notificationService.publishPaymentReminder({
      userId: friendUserId,
      friendTabId: trimmed,
      fromUserId: userId,
      fromUserName: sender?.name ?? null,
      fromUserUsername: sender?.username ?? null,
      tone,
      amountDisplay,
      createdAt: new Date(),
    });

    log("info", "Payment reminder sent", { fromUserId: userId, toUserId: friendUserId, friendTabId: trimmed, tone, amountDisplay });
    return ok(undefined);
  },
};
