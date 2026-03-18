import { Hono } from "hono";
import { tabInviteService } from "services";
import { authMiddleware, type AuthContext } from "../auth.js";
import { log } from "../lib/logger.js";

export const tabInvitesRoutes = new Hono<{
  Variables: { auth: AuthContext };
}>();

tabInvitesRoutes.get("/by-token", async (c) => {
  const token = c.req.query("token");
  if (!token?.trim()) {
    return c.json(
      { success: false, error: "Invalid token", tab: null, creator: null },
      400,
    );
  }

  const result = await tabInviteService.getByToken(token.trim());
  if (!result.success) {
    return c.json(
      {
        success: false,
        error: result.error,
        tab: null,
        creator: null,
      },
      result.status as 400 | 403 | 404,
    );
  }

  log("info", "Tab invite by-token fetched", { tabId: result.data.tabId });
  return c.json({
    success: true,
    tab: result.data.tab,
    creator: result.data.creator,
    tabId: result.data.tabId,
  });
});

tabInvitesRoutes.use("*", authMiddleware);

tabInvitesRoutes.post("/join-by-token", async (c) => {
  const { userId } = c.get("auth");

  const body = await c.req.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token.trim() : null;

  if (!token) {
    return c.json({ success: false, error: "Invalid token", tabId: null }, 400);
  }

  const result = await tabInviteService.joinByToken(userId, token);
  if (!result.success) {
    return c.json(
      { success: false, error: result.error, tabId: null },
      result.status as 400 | 403 | 404,
    );
  }

  if (result.data.alreadyMember) {
    log("info", "Tab join by token (already member)", {
      userId,
      tabId: result.data.tabId,
    });
  } else {
    log("info", "Tab joined by token", { userId, tabId: result.data.tabId });
  }
  return c.json({
    success: true,
    tabId: result.data.tabId,
    alreadyMember: result.data.alreadyMember,
  });
});

tabInvitesRoutes.get("/token", async (c) => {
  const { userId } = c.get("auth");
  const tabId = c.req.query("tabId");

  if (!tabId) {
    return c.json({ success: false, error: "tabId required", url: null }, 400);
  }

  const result = await tabInviteService.getToken(userId, tabId);
  if (!result.success) {
    return c.json(
      { success: false, error: result.error, url: null },
      result.status as 400 | 403 | 404,
    );
  }

  log("info", "Tab invite token generated", { userId, tabId });
  return c.json({ success: true, url: result.data.url });
});

tabInvitesRoutes.get("/requests/pending", async (c) => {
  const { userId } = c.get("auth");

  const result = await tabInviteService.getPendingRequests(userId);

  log("info", "Tab invite requests pending fetched", {
    userId,
    count: result.data.requests.length,
  });
  return c.json({
    success: true,
    requests: result.data.requests,
  });
});

tabInvitesRoutes.post("/requests", async (c) => {
  const { userId } = c.get("auth");

  const body = await c.req.json().catch(() => ({}));
  const tabId = body.tabId;
  const username = body.username;

  if (typeof tabId !== "string" || !tabId) {
    return c.json({ success: false, error: "Tab ID is required" }, 400);
  }
  if (typeof username !== "string" || !username.trim()) {
    return c.json({ success: false, error: "Username is required" }, 400);
  }

  const result = await tabInviteService.sendRequest(
    userId,
    tabId,
    username.trim(),
  );
  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.status as 400 | 403 | 404);
  }

  log("info", "Tab invite sent", { tabId, fromUserId: userId });
  return c.json({ success: true });
});

tabInvitesRoutes.post("/requests/:id/accept", async (c) => {
  const { userId } = c.get("auth");
  const requestId = c.req.param("id");

  const result = await tabInviteService.acceptRequest(userId, requestId);
  if (!result.success) {
    return c.json(
      {
        success: false,
        error: result.error,
        tabId: null,
      },
      result.status as 400 | 403 | 404,
    );
  }

  log("info", "Tab invite accepted", {
    requestId,
    accepterUserId: userId,
    tabId: result.data.tabId,
  });
  return c.json({
    success: true,
    tabId: result.data.tabId,
    alreadyMember: result.data.alreadyMember,
  });
});

tabInvitesRoutes.post("/requests/:id/reject", async (c) => {
  const { userId } = c.get("auth");
  const requestId = c.req.param("id");

  const result = await tabInviteService.rejectRequest(userId, requestId);
  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.status as 400 | 403 | 404);
  }

  log("info", "Tab invite rejected", { requestId, userId });
  return c.json({ success: true });
});
