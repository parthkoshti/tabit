import { Hono } from "hono";
import { db, pushSubscription } from "db";
import { eq, and } from "drizzle-orm";
import { publishNotification } from "../lib/redis.js";
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

  await db.insert(pushSubscription).values({
    userId,
    endpoint,
    p256dh,
    auth,
    userAgent,
  });

  return c.json({ success: true });
});

pushRoutes.delete("/subscribe", async (c) => {
  const { userId } = c.get("auth");

  const body = await c.req.json().catch(() => ({}));
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : null;

  if (!endpoint) {
    return c.json({ error: "endpoint required" }, 400);
  }

  await db
    .delete(pushSubscription)
    .where(and(eq(pushSubscription.userId, userId), eq(pushSubscription.endpoint, endpoint)));

  return c.json({ success: true });
});

pushRoutes.post("/test", async (c) => {
  const { userId } = c.get("auth");
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
