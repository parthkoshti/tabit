import { Hono } from "hono";
import { authMiddleware, type AuthContext } from "../auth.js";
import { log } from "../lib/logger.js";
import { friendService } from "services";

export const friendsRoutes = new Hono<{ Variables: { auth: AuthContext } }>();

friendsRoutes.use("*", authMiddleware);

friendsRoutes.get("/requests/pending", async (c) => {
  const { userId } = c.get("auth");
  const result = await friendService.getPendingRequests(userId);
  log("info", "Friend requests pending fetched", {
    userId,
    count: result.data.requests.length,
  });
  return c.json({ success: true, requests: result.data.requests });
});

friendsRoutes.post("/requests", async (c) => {
  const { userId } = c.get("auth");
  const body = await c.req.json().catch(() => ({}));
  const username = body.username;

  const result = await friendService.sendRequest(userId, username ?? "");
  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.status as 400 | 403 | 404);
  }

  log("info", "Friend request created", { userId });
  return c.json({ success: true });
});

friendsRoutes.post("/requests/:id/accept", async (c) => {
  const { userId } = c.get("auth");
  const requestId = c.req.param("id");

  const result = await friendService.acceptRequest(requestId, userId);
  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.status as 400 | 403 | 404);
  }

  log("info", "Friend request accepted", {
    requestId,
    accepterUserId: userId,
    friendTabId: result.data.friendTabId,
  });
  return c.json({ success: true, friendTabId: result.data.friendTabId });
});

friendsRoutes.post("/requests/:id/reject", async (c) => {
  const { userId } = c.get("auth");
  const requestId = c.req.param("id");

  const result = await friendService.rejectRequest(requestId, userId);
  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.status as 400 | 403 | 404);
  }

  log("info", "Friend request rejected", { requestId, userId });
  return c.json({ success: true });
});

friendsRoutes.get("/token", async (c) => {
  const { userId } = c.get("auth");

  const result = await friendService.getInviteToken(userId);
  if (!result.success) {
    return c.json(
      { success: false, error: result.error, token: null, url: null },
      result.status as 400 | 403 | 404,
    );
  }

  log("info", "Invite token generated", { userId });
  return c.json({
    success: true,
    token: result.data.token,
    url: result.data.url,
  });
});

friendsRoutes.post("/add-by-token", async (c) => {
  const { userId } = c.get("auth");
  const body = await c.req.json().catch(() => ({}));
  const token = body.token;

  const result = await friendService.addByToken(userId, token ?? "");
  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.status as 400 | 403 | 404);
  }

  log("info", "Friend added by token", {
    userId,
    friendTabId: result.data.friendTabId,
    alreadyFriends: result.data.alreadyFriends,
  });
  return c.json({
    success: true,
    friendTabId: result.data.friendTabId,
    alreadyFriends: result.data.alreadyFriends,
  });
});

friendsRoutes.get("/search", async (c) => {
  const { userId } = c.get("auth");
  const query = c.req.query("q") ?? "";
  const includeFriends = c.req.query("includeFriends") === "true";

  const result = await friendService.searchUsers(userId, query, includeFriends);
  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.status as 400 | 403 | 404);
  }

  log("info", "User search", {
    userId,
    query: query.trim().toLowerCase(),
    resultCount: result.data.length,
  });
  return c.json({ success: true, users: result.data });
});

friendsRoutes.get("/", async (c) => {
  const { userId } = c.get("auth");
  const result = await friendService.getFriends(userId);
  log("info", "Friends list fetched", {
    userId,
    count: result.data.friends.length,
  });
  return c.json({ success: true, friends: result.data.friends });
});

friendsRoutes.post("/poke", async (c) => {
  const { userId } = c.get("auth");
  const body = await c.req.json().catch(() => ({}));
  const friendTabId = body.friendTabId;

  const result = await friendService.poke(userId, friendTabId ?? "");
  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.status as 400 | 403 | 404);
  }

  log("info", "User poked", { fromUserId: userId, friendTabId: friendTabId?.trim() });
  return c.json({ success: true });
});
