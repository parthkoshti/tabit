import { Hono } from "hono";
import { friend, tabInvite } from "data";
import { authMiddleware, type AuthContext } from "../auth.js";
import { log } from "../lib/logger.js";

export const notificationsRoutes = new Hono<{
  Variables: { auth: AuthContext };
}>();

notificationsRoutes.use("*", authMiddleware);

notificationsRoutes.get("/token", async (c) => {
  const { userId } = c.get("auth");
  const token = Buffer.from(`${userId}:${Date.now()}`).toString("base64url");
  return c.json({ token });
});

notificationsRoutes.get("/missed", async (c) => {
  const { userId } = c.get("auth");
  const sinceParam = c.req.query("since");

  const since = sinceParam ? Number(sinceParam) : 0;
  if (!Number.isFinite(since) || since < 0) {
    return c.json({ success: false, error: "Invalid since parameter" }, 400);
  }

  const sinceDate = new Date(since);

  const [friendRequests, tabInvites] = await Promise.all([
    friend.getMissedFriendRequests(userId, sinceDate),
    tabInvite.getMissedTabInvites(userId, sinceDate),
  ]);

  log("info", "Missed notifications fetched", {
    userId,
    since,
    friendRequestCount: friendRequests.length,
    tabInviteCount: tabInvites.length,
  });

  return c.json({
    success: true,
    friendRequests: friendRequests.map((r) => ({
      id: r.id,
      type: "friend_request" as const,
      requestId: r.id,
      fromUserId: r.fromUserId,
      fromUserUsername: r.fromUserUsername,
      fromUserName: r.fromUserName,
      createdAt: r.createdAt,
    })),
    tabInvites: tabInvites.map((r) => ({
      id: r.id,
      type: "tab_invite" as const,
      requestId: r.id,
      tabId: r.tabId,
      tabName: r.tabName,
      fromUserId: r.fromUserId,
      fromUserUsername: r.fromUserUsername,
      fromUserName: r.fromUserName,
      createdAt: r.createdAt,
    })),
  });
});
