import "./instrumentation.js";
import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import type { IncomingMessage } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, type WebSocket } from "ws";
import { Redis } from "ioredis";
import webpush from "web-push";
import { db, pushSubscription } from "db";
import { eq, and } from "drizzle-orm";
import { log as otelLog } from "otel";

const LOG_PREFIX = "[notifications]";

function log(
  level: "info" | "warn" | "error",
  msg: string,
  data?: Record<string, unknown>,
) {
  otelLog(level, `${LOG_PREFIX} ${msg}`, data);
}

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const redis = new Redis(redisUrl);
const redisSubscriber = new Redis(redisUrl);

redis.on("connect", () => log("info", "Redis connected"));
redis.on("error", (err) => log("error", "Redis error", { error: String(err) }));
redisSubscriber.on("connect", () => log("info", "Redis subscriber connected"));
redisSubscriber.on("error", (err) => log("error", "Redis subscriber error", { error: String(err) }));

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    "mailto:support@tabit.in",
    vapidPublicKey,
    vapidPrivateKey,
  );
  log("info", "VAPID keys configured, push notifications enabled", {
    vapidPublicKey,
    vapidPrivateKey,
  });
} else {
  log("warn", "VAPID keys not configured, push notifications disabled");
}

const userConnections = new Map<string, Set<WebSocket>>();
const subscribedUsers = new Set<string>();

async function subscribeToUser(userId: string) {
  if (subscribedUsers.has(userId)) return;
  subscribedUsers.add(userId);
  await redisSubscriber.subscribe(`notifications:user:${userId}`);
  log("info", "Subscribed to user notifications", { userId });
}

async function ensureUserSubscribed(userId: string) {
  if (subscribedUsers.has(userId)) return;
  
  const hasPushSubscriptions = await db
    .select({ id: pushSubscription.id })
    .from(pushSubscription)
    .where(eq(pushSubscription.userId, userId))
    .limit(1);
  
  if (hasPushSubscriptions.length > 0) {
    await subscribeToUser(userId);
  }
}

async function unsubscribeFromUser(userId: string) {
  if (!subscribedUsers.has(userId)) return;
  
  const hasConnections = userConnections.has(userId) && userConnections.get(userId)!.size > 0;
  if (hasConnections) return;
  
  const hasPushSubscriptions = await db
    .select({ id: pushSubscription.id })
    .from(pushSubscription)
    .where(eq(pushSubscription.userId, userId))
    .limit(1);
  
  if (hasPushSubscriptions.length > 0) return;
  
  subscribedUsers.delete(userId);
  await redisSubscriber.unsubscribe(`notifications:user:${userId}`);
  log("info", "Unsubscribed from user notifications", { userId });
}

const appBaseUrl =
  process.env.NEXT_PUBLIC_PWA_URL ??
  process.env.NEXT_PUBLIC_WEB_URL ??
  process.env.APP_URL ??
  "https://localhost:3003";

function getPushTitle(payload: {
  type: string;
  fromUserName?: string | null;
  tabName?: string;
  description?: string;
  amount?: string;
  count?: number;
  forcePush?: boolean;
}): string {
  if (payload.forcePush)
    return payload.type === "tab_invite"
      ? "Test tab invite"
      : "Test push notification";
  if (payload.type === "friend_request" && payload.fromUserName) {
    return `Friend request from ${payload.fromUserName}`;
  }
  if (
    payload.type === "tab_invite" &&
    payload.fromUserName &&
    payload.tabName
  ) {
    return `${payload.fromUserName} invited you to ${payload.tabName}`;
  }
  if (payload.type === "friend_request_accepted" && payload.fromUserName) {
    return `${payload.fromUserName} accepted your friend request`;
  }
  if (
    payload.type === "tab_invite_accepted" &&
    payload.fromUserName &&
    payload.tabName
  ) {
    return `${payload.fromUserName} joined ${payload.tabName}`;
  }
  if (
    payload.type === "expense_added" &&
    payload.fromUserName &&
    payload.tabName
  ) {
    const desc = payload.description ? ` for ${payload.description}` : "";
    const amt = payload.amount ? ` $${payload.amount}` : "";
    return `${payload.fromUserName} added${amt}${desc} to ${payload.tabName}`;
  }
  if (
    payload.type === "expense_updated" &&
    payload.fromUserName &&
    payload.tabName
  ) {
    return `${payload.fromUserName} updated an expense in ${payload.tabName}`;
  }
  if (
    payload.type === "expenses_bulk_imported" &&
    payload.tabName &&
    typeof payload.count === "number"
  ) {
    const who = payload.fromUserName ?? "Someone";
    return `${who} imported ${payload.count} expense${payload.count !== 1 ? "s" : ""} to ${payload.tabName}`;
  }
  if (payload.type === "poke" && payload.fromUserName) {
    return `${payload.fromUserName} poked you`;
  }
  if (payload.type === "poke") return "Someone poked you";
  if (payload.type === "friend_request") return "New friend request";
  if (payload.type === "tab_invite") return "New tab invite";
  if (payload.type === "friend_request_accepted")
    return "Friend request accepted";
  if (payload.type === "tab_invite_accepted") return "Tab invite accepted";
  if (payload.type === "expense_added") return "New expense added";
  if (payload.type === "expense_updated") return "Expense updated";
  if (payload.type === "expenses_bulk_imported") return "Expenses imported";
  return "New notification";
}

function getPushBody(payload: {
  type: string;
  description?: string;
  amount?: string;
  tabName?: string;
  count?: number;
  forcePush?: boolean;
}): string {
  if (payload.forcePush) return "This is a test notification";
  if (payload.type === "friend_request") return "New friend request";
  if (payload.type === "tab_invite") return "New tab invite";
  if (payload.type === "friend_request_accepted")
    return "Accepted your friend request";
  if (payload.type === "tab_invite_accepted") return "Joined your tab";
  if (payload.type === "expense_added") {
    if (payload.description && payload.amount) {
      return `${payload.description} - $${payload.amount}`;
    }
    if (payload.description) return payload.description;
    if (payload.amount) return `$${payload.amount}`;
    return "New expense added to tab";
  }
  if (payload.type === "expense_updated") {
    if (payload.description) return payload.description;
    return "An expense was updated";
  }
  if (
    payload.type === "expenses_bulk_imported" &&
    typeof payload.count === "number" &&
    payload.tabName
  ) {
    return `${payload.count} expense${payload.count !== 1 ? "s" : ""} imported to ${payload.tabName}`;
  }
  if (payload.type === "poke") return "Poke them back!";
  return "You have a new notification";
}

function getNavigatePath(payload: {
  type: string;
  tabId?: string;
  expenseId?: string;
  friendTabId?: string;
}): string {
  if (payload.type === "tab_invite") return "/tabs";
  if (payload.type === "friend_request_accepted" && payload.friendTabId) {
    return `/tabs/${payload.friendTabId}`;
  }
  if (payload.type === "tab_invite_accepted" && payload.tabId) {
    return `/tabs/${payload.tabId}`;
  }
  if (
    (payload.type === "expense_added" || payload.type === "expense_updated") &&
    payload.tabId
  ) {
    return payload.expenseId
      ? `/tabs/${payload.tabId}/expenses/${payload.expenseId}`
      : `/tabs/${payload.tabId}`;
  }
  if (payload.type === "expenses_bulk_imported" && payload.tabId) {
    return `/tabs/${payload.tabId}`;
  }
  if (payload.type === "poke") return "/friends";
  return "/friends";
}

async function sendPushNotifications(
  userId: string,
  payload: unknown,
): Promise<{ removedInvalidSubscriptions: boolean }> {
  if (!vapidPublicKey || !vapidPrivateKey)
    return { removedInvalidSubscriptions: false };

  const subs = await db
    .select()
    .from(pushSubscription)
    .where(eq(pushSubscription.userId, userId))
    .limit(10);

  if (subs.length === 0) return { removedInvalidSubscriptions: false };

  const payloadObj =
    typeof payload === "string" ? JSON.parse(payload) : payload;
  log("info", "Sending push notifications", {
    userId,
    subscriptionCount: subs.length,
    type: payloadObj?.type,
    vapidPublicKey,
  });
  const title = getPushTitle(payloadObj);
  const body = getPushBody(payloadObj);
  const navigate = new URL(getNavigatePath(payloadObj), appBaseUrl).href;

  const pushPayload = JSON.stringify({
    web_push: 8030,
    notification: {
      title,
      body,
      navigate,
      silent: false,
      lang: "en-US",
      dir: "ltr",
    },
    title,
    body,
    ...payloadObj,
  });

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        pushPayload,
        { TTL: 86400, urgency: "high" },
      ),
    ),
  );
  const fulfilled = results.filter((r) => r.status === "fulfilled").length;
  const rejected = results.filter((r) => r.status === "rejected").length;
  let removedInvalidSubscriptions = false;
  if (rejected > 0) {
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const sub = subs[i];
      if (r.status === "rejected" && sub) {
        const err = r.reason as { statusCode?: number; body?: string };
        const statusCode = err?.statusCode;
        const body = err?.body;
        log("error", "Push send failed", {
          userId,
          error: String(r.reason),
          statusCode,
          body: body?.slice?.(0, 200),
          endpoint: sub.endpoint.slice(0, 60),
          vapidPublicKey,
        });
        const bodyStr = typeof body === "string" ? body : "";
        const isExpired = statusCode === 404 || statusCode === 410;
        const isVapidMismatch =
          (statusCode === 400 && bodyStr.includes("VapidPkHashMismatch")) ||
          (statusCode === 403 &&
            bodyStr.includes("VAPID credentials") &&
            bodyStr.includes("do not correspond"));
        if (isExpired || isVapidMismatch) {
          await db
            .delete(pushSubscription)
            .where(
              and(
                eq(pushSubscription.userId, userId),
                eq(pushSubscription.endpoint, sub.endpoint),
              ),
            );
          removedInvalidSubscriptions = true;
          log("info", "Removed invalid push subscription", {
            userId,
            endpoint: sub.endpoint.slice(0, 60),
            reason: isVapidMismatch ? "VAPID mismatch" : "expired",
            vapidPublicKey,
          });
        }
      }
    }
  }
  log("info", "Push notifications sent", { userId, fulfilled, rejected });
  return { removedInvalidSubscriptions };
}

redisSubscriber.on("message", (channel, message) => {
  if (channel === "notifications:subscription-control") {
    try {
      const { action, userId } = JSON.parse(message);
      if (action === "subscribe") {
        ensureUserSubscribed(userId);
      } else if (action === "unsubscribe") {
        unsubscribeFromUser(userId);
      }
    } catch (err) {
      log("error", "Subscription control message parse error", {
        error: String(err),
      });
    }
    return;
  }

  const match = channel.match(/^notifications:user:(.+)$/);
  if (match) {
    const userId = match[1];
    const payload = typeof message === "string" ? JSON.parse(message) : message;
    const connections = userConnections.get(userId);
    const hasConnections = connections && connections.size > 0;

    log("info", "Notification received", {
      userId,
      type: payload?.type,
      wsClients: hasConnections ? connections!.size : 0,
    });

    if (hasConnections) {
      connections!.forEach((conn) => {
        if (conn.readyState === 1) {
          conn.send(message);
        }
      });
    }
    sendPushNotifications(userId, message)
      .then(({ removedInvalidSubscriptions }) => {
        if (removedInvalidSubscriptions && hasConnections) {
          const resubscribeMsg = JSON.stringify({
            type: "push_resubscription_required",
          });
          connections!.forEach((conn) => {
            if (conn.readyState === 1) {
              conn.send(resubscribeMsg);
            }
          });
        }
      })
      .catch((err) =>
        log("error", "Push notification error", {
          userId,
          error: String(err),
          vapidPublicKey,
        }),
      );
  }
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const certDir = join(__dirname, "../../web/certificates");
const certPath =
  process.env.NOTIFICATIONS_WS_HTTPS_CERT ?? join(certDir, "cert.pem");
const keyPath =
  process.env.NOTIFICATIONS_WS_HTTPS_KEY ?? join(certDir, "key.pem");

let server: ReturnType<typeof createHttpServer>;
if (existsSync(certPath) && existsSync(keyPath)) {
  try {
    server = createHttpsServer(
      {
        cert: readFileSync(certPath),
        key: readFileSync(keyPath),
      },
      (_req, res) => {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("Notifications WebSocket server");
      },
    );
    log("info", "Notifications WebSocket server using HTTPS (WSS)");
  } catch (err) {
    log("warn", "HTTPS cert load failed, falling back to HTTP", {
      error: String(err),
    });
    server = createHttpServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("Notifications WebSocket server");
    });
  }
} else {
  log("info", "Notifications WebSocket server using HTTP (WS)");
  server = createHttpServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Notifications WebSocket server");
  });
}

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url ?? "", `http://${request.headers.host}`);
  const token = url.searchParams.get("token");

  if (!token) {
    log("warn", "WebSocket upgrade rejected: missing token");
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const [userId, timestampStr] = decoded.split(":");
    const timestamp = Number(timestampStr);

    if (!userId || !timestamp) {
      log("warn", "WebSocket upgrade rejected: invalid token format");
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    const age = Date.now() - timestamp;
    if (age > 5 * 60 * 1000) {
      log("warn", "WebSocket upgrade rejected: token expired", { userId });
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request, userId);
    });
  } catch (err) {
    log("error", "WebSocket upgrade failed", { error: String(err) });
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
  }
});

wss.on(
  "connection",
  (ws: WebSocket, _request: IncomingMessage, userId: string) => {
    if (!userConnections.has(userId)) {
      userConnections.set(userId, new Set());
      subscribeToUser(userId);
    }
    userConnections.get(userId)!.add(ws);
    log("info", "WebSocket client connected", {
      userId,
      totalConnections: userConnections.get(userId)!.size,
    });

    ws.on("message", (data: Buffer) => {
      try {
        const payload = JSON.parse(data.toString());
        if (payload.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
        }
      } catch {
        // ignore non-JSON or invalid messages
      }
    });

    ws.on("close", () => {
      const connections = userConnections.get(userId);
      if (connections) {
        connections.delete(ws);
        if (connections.size === 0) {
          userConnections.delete(userId);
          log("info", "WebSocket client disconnected (last for user)", {
            userId,
          });
        }
      }
    });
  },
);

async function subscribeToAllUsersWithPushSubscriptions() {
  try {
    const users = await db
      .selectDistinct({ userId: pushSubscription.userId })
      .from(pushSubscription);
    
    log("info", "Subscribing to users with push subscriptions", {
      userCount: users.length,
    });

    for (const { userId } of users) {
      await subscribeToUser(userId);
    }

    log("info", "Subscribed to all users with push subscriptions", {
      subscribedCount: subscribedUsers.size,
    });
  } catch (err) {
    log("error", "Failed to subscribe to users on startup", {
      error: String(err),
    });
  }
}

async function cleanupStaleSubscriptions() {
  try {
    const subscribedUserIds = Array.from(subscribedUsers);
    
    for (const userId of subscribedUserIds) {
      const hasPushSubscriptions = await db
        .select({ id: pushSubscription.id })
        .from(pushSubscription)
        .where(eq(pushSubscription.userId, userId))
        .limit(1);
      
      if (hasPushSubscriptions.length === 0 && !userConnections.has(userId)) {
        subscribedUsers.delete(userId);
        await redis.unsubscribe(`notifications:user:${userId}`);
        log("info", "Unsubscribed from user (no push subscriptions)", { userId });
      }
    }
    
    log("info", "Cleanup complete", {
      remainingSubscriptions: subscribedUsers.size,
    });
  } catch (err) {
    log("error", "Cleanup failed", { error: String(err) });
  }
}

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

const port = Number(process.env.PORT ?? 3002);
server.listen(port, async () => {
  log("info", `Notifications WebSocket server listening on port ${port}`);
  
  await redisSubscriber.subscribe("notifications:subscription-control");
  log("info", "Subscribed to subscription control channel");
  
  await subscribeToAllUsersWithPushSubscriptions();
  
  setInterval(() => {
    cleanupStaleSubscriptions();
  }, CLEANUP_INTERVAL_MS);
});
