import { Hono } from "hono";
import { db, friendRequest, tabInviteRequest, user, tab } from "db";
import { eq, and, desc, gt } from "drizzle-orm";
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
    db
      .select({
        id: friendRequest.id,
        fromUserId: friendRequest.fromUserId,
        fromUserUsername: user.username,
        fromUserName: user.name,
        createdAt: friendRequest.createdAt,
      })
      .from(friendRequest)
      .innerJoin(user, eq(friendRequest.fromUserId, user.id))
      .where(
        and(
          eq(friendRequest.toUserId, userId),
          eq(friendRequest.status, "pending"),
          gt(friendRequest.createdAt, sinceDate),
        ),
      )
      .orderBy(desc(friendRequest.createdAt)),

    db
      .select({
        id: tabInviteRequest.id,
        tabId: tabInviteRequest.tabId,
        tabName: tab.name,
        fromUserId: tabInviteRequest.fromUserId,
        fromUserUsername: user.username,
        fromUserName: user.name,
        createdAt: tabInviteRequest.createdAt,
      })
      .from(tabInviteRequest)
      .innerJoin(tab, eq(tabInviteRequest.tabId, tab.id))
      .innerJoin(user, eq(tabInviteRequest.fromUserId, user.id))
      .where(
        and(
          eq(tabInviteRequest.toUserId, userId),
          eq(tabInviteRequest.status, "pending"),
          gt(tabInviteRequest.createdAt, sinceDate),
        ),
      )
      .orderBy(desc(tabInviteRequest.createdAt)),
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
