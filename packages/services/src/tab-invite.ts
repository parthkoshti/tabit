import { tabInvite as tabInviteData, tab, user } from "data";
import { notificationService } from "./notification.js";
import { ok, err, type Result } from "./types.js";

export const tabInviteService = {
  getByToken: async (token: string) => {
    const pending = await tabInviteData.getPendingByToken(token);
    if (!pending) {
      return err("Invalid or expired link", 404) as Result<
        { tab: { id: string; name: string }; creator: { id: string; name: string | null; username: string | null }; tabId: string },
        string
      >;
    }

    const [tabRow, creator] = await Promise.all([
      tabInviteData.getTabById(pending.tabId),
      tabInviteData.getUserById(pending.createdByUserId),
    ]);

    if (!tabRow || !creator) {
      return err("Tab or creator not found", 404) as Result<
        { tab: { id: string; name: string }; creator: { id: string; name: string | null; username: string | null }; tabId: string },
        string
      >;
    }

    return ok({
      tab: tabRow,
      creator,
      tabId: pending.tabId,
    });
  },

  joinByToken: async (
    userId: string,
    token: string,
  ): Promise<Result<{ tabId: string; alreadyMember?: boolean }>> => {
    const pending = await tabInviteData.getPendingInviteByToken(token);
    if (!pending) {
      return err("Invalid or expired link", 404);
    }

    const existing = await tabInviteData.isMember(pending.tabId, userId);
    if (existing) {
      await tabInviteData.deletePendingInvite(pending.id);
      return ok({ tabId: pending.tabId, alreadyMember: true });
    }

    await addUserToTabAndCreateFriendships(userId, pending.tabId);
    await tabInviteData.deletePendingInvite(pending.id);
    return ok({ tabId: pending.tabId });
  },

  getToken: async (
    userId: string,
    tabId: string,
  ): Promise<Result<{ url: string }>> => {
    const isMember = await tabInviteData.isMember(tabId, userId);
    if (!isMember) {
      return err("Not a member of this tab", 403);
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const existing = await tabInviteData.getExistingPendingByTabAndCreator(
      tabId,
      userId,
    );

    let token: string;
    if (existing) {
      token = existing.token;
    } else {
      await tabInviteData.deletePendingInvitesByTabAndCreator(tabId, userId);
      token = tabInviteData.generateToken();
      for (let i = 0; i < 5; i++) {
        try {
          await tabInviteData.createPendingInvite({
            token,
            tabId,
            createdByUserId: userId,
            expiresAt,
          });
          break;
        } catch {
          token = tabInviteData.generateToken();
          if (i === 4) throw new Error("Failed to generate invite token");
        }
      }
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_PWA_URL ??
      process.env.NEXT_PUBLIC_WEB_URL ??
      process.env.APP_URL ??
      "http://localhost:3003";
    const url = `${baseUrl}/invite?type=tab&token=${encodeURIComponent(token)}`;

    return ok({ url });
  },

  getPendingRequests: async (userId: string) => {
    const rows = await tabInviteData.getPendingRequests(userId);
    return ok({
      requests: rows.map((r) => ({
        id: r.id,
        tabId: r.tabId,
        fromUserId: r.fromUserId,
        tabName: r.tabName,
        fromUserName: r.fromUserName,
        fromUserUsername: r.fromUserUsername,
        createdAt: r.createdAt,
      })),
    });
  },

  sendRequest: async (
    userId: string,
    tabId: string,
    username: string,
  ): Promise<Result<void>> => {
    const isMember = await tabInviteData.isMember(tabId, userId);
    if (!isMember) {
      return err("Not a member of this tab", 403);
    }

    const targetUser = await user.getByUsername(username.trim().toLowerCase());
    if (!targetUser) {
      return err("User not found", 404);
    }

    if (targetUser.id === userId) {
      return err("You cannot invite yourself", 400);
    }

    const existingMember = await tabInviteData.isMember(tabId, targetUser.id);
    if (existingMember) {
      return err("User is already a member", 400);
    }

    const existingRequest = await tabInviteData.checkExistingRequest(
      tabId,
      targetUser.id,
    );
    if (existingRequest) {
      return err("Invite already sent", 400);
    }

    const [tabRow, fromUser] = await Promise.all([
      tabInviteData.getTabById(tabId),
      tabInviteData.getUserById(userId),
    ]);

    const inserted = await tabInviteData.createRequest({
      tabId,
      fromUserId: userId,
      toUserId: targetUser.id,
    });

    await notificationService.publishTabInvite({
      userId: targetUser.id,
      requestId: inserted.id,
      tabId,
      tabName: tabRow?.name ?? "Tab",
      fromUserId: userId,
      fromUserName: fromUser?.name ?? null,
      fromUserUsername: fromUser?.username ?? null,
      createdAt: inserted.createdAt,
    });

    return ok(undefined);
  },

  acceptRequest: async (
    userId: string,
    requestId: string,
  ): Promise<Result<{ tabId: string; alreadyMember?: boolean }>> => {
    const req = await tabInviteData.getRequestByIdAndToUser(requestId, userId);
    if (!req) {
      return err("Request not found or already handled", 404);
    }

    const existing = await tabInviteData.isMember(req.tabId, userId);
    if (existing) {
      await tabInviteData.updateRequestStatus(requestId, "accepted");
      await publishTabInviteAcceptedNotification(userId, requestId, req);
      return ok({ tabId: req.tabId, alreadyMember: true });
    }

    await addUserToTabAndCreateFriendships(userId, req.tabId);
    await tabInviteData.updateRequestStatus(requestId, "accepted");
    await publishTabInviteAcceptedNotification(userId, requestId, req);
    return ok({ tabId: req.tabId });
  },

  rejectRequest: async (
    userId: string,
    requestId: string,
  ): Promise<Result<void>> => {
    const req = await tabInviteData.getRequestByIdAndToUser(requestId, userId);
    if (!req) {
      return err("Request not found or already handled", 404);
    }

    await tabInviteData.updateRequestStatus(requestId, "rejected");
    return ok(undefined);
  },
};

async function addUserToTabAndCreateFriendships(
  userId: string,
  tabId: string,
): Promise<void> {
  const members = await tabInviteData.getMembers(tabId);
  const newUser = await user.getById(userId);
  const currency = newUser?.defaultCurrency ?? "USD";

  await tab.addMember(tabId, userId, "member");

  for (const m of members) {
    if (m.userId !== userId) {
      await tab.createDirect(userId, m.userId, currency);
    }
  }
}

async function publishTabInviteAcceptedNotification(
  accepterUserId: string,
  requestId: string,
  req: { tabId: string; fromUserId: string },
): Promise<void> {
  const [tabRow, accepter] = await Promise.all([
    tabInviteData.getTabById(req.tabId),
    tabInviteData.getUserById(accepterUserId),
  ]);

  await notificationService.publishTabInviteAccepted({
    userId: req.fromUserId,
    requestId,
    tabId: req.tabId,
    tabName: tabRow?.name ?? "Tab",
    fromUserId: accepterUserId,
    fromUserName: accepter?.name ?? null,
    fromUserUsername: accepter?.username ?? null,
    createdAt: new Date(),
  });
}
