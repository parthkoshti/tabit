import { Hono } from "hono";
import { push as pushData } from "data";
import { publishNotification, publishSubscriptionControl } from "../lib/redis.js";
import { log } from "../lib/logger.js";
import type { AuthContext } from "../auth.js";
import { authMiddleware } from "../auth.js";

export const pushRoutes = new Hono<{ Variables: { auth: AuthContext } }>();

pushRoutes.use("*", authMiddleware);

pushRoutes.post("/subscribe", async (c) => {
  const { userId } = c.get("auth");

  const body = await c.req.json().catch(() => ({}));
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : null;
  const keys = body.keys && typeof body.keys === "object" ? body.keys : null;
  const p256dh = keys?.p256dh && typeof keys.p256dh === "string" ? keys.p256dh : null;
  const auth = keys?.auth && typeof keys.auth === "string" ? keys.auth : null;

  if (!endpoint || !p256dh || !auth) {
    return c.json({ error: "Invalid subscription: endpoint, keys.p256dh, keys.auth required" }, 400);
  }

  const userAgent = c.req.header("User-Agent") ?? null;

  await pushData.insert({
    userId,
    endpoint,
    p256dh,
    auth,
    userAgent,
  });

  log("info", "Push subscription added", { userId });

  await publishSubscriptionControl("subscribe", userId);

  return c.json({ success: true });
});

pushRoutes.delete("/subscribe", async (c) => {
  const { userId } = c.get("auth");

  const body = await c.req.json().catch(() => ({}));
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : null;

  if (!endpoint) {
    return c.json({ error: "endpoint required" }, 400);
  }

  await pushData.deleteByUserAndEndpoint(userId, endpoint);

  log("info", "Push subscription removed", { userId });

  const remainingCount = await pushData.countByUserId(userId);

  if (remainingCount === 0) {
    await publishSubscriptionControl("unsubscribe", userId);
  }

  return c.json({ success: true });
});

pushRoutes.post("/test", async (c) => {
  const { userId } = c.get("auth");
  log("info", "Push test requested", { userId, type: "friend_request" });
  await publishNotification(
    userId,
    {
      type: "friend_request",
      requestId: "test-" + Date.now(),
      fromUserId: userId,
      fromUserName: "Test",
      fromUserUsername: "test",
      createdAt: new Date().toISOString(),
    },
    { forcePush: true }
  );
  return c.json({ success: true });
});

pushRoutes.post("/test-tab-invite", async (c) => {
  const { userId } = c.get("auth");
  log("info", "Push test requested", { userId, type: "tab_invite" });
  await publishNotification(
    userId,
    {
      type: "tab_invite",
      requestId: "test-" + Date.now(),
      tabId: "test-tab",
      tabName: "Test Tab",
      fromUserId: userId,
      fromUserName: "Test",
      fromUserUsername: "test",
      createdAt: new Date().toISOString(),
    },
    { forcePush: true }
  );
  return c.json({ success: true });
});
