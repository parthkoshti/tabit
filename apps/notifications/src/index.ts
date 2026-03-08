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
import { eq } from "drizzle-orm";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const redis = new Redis(redisUrl);

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails("mailto:support@tabit.app", vapidPublicKey, vapidPrivateKey);
}

const userConnections = new Map<string, Set<WebSocket>>();
const subscribedUsers = new Set<string>();

function subscribeToUser(userId: string) {
  if (subscribedUsers.has(userId)) return;
  subscribedUsers.add(userId);
  redis.subscribe(`notifications:user:${userId}`);
}

function unsubscribeFromUser(userId: string) {
  if (!subscribedUsers.has(userId)) return;
  const connections = userConnections.get(userId);
  if (!connections || connections.size === 0) {
    subscribedUsers.delete(userId);
    redis.unsubscribe(`notifications:user:${userId}`);
  }
}

const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "https://localhost:3000";

function getPushTitle(payload: { type: string; fromUserName?: string | null; tabName?: string; forcePush?: boolean }): string {
  if (payload.forcePush) return payload.type === "tab_invite" ? "Test tab invite" : "Test push notification";
  if (payload.type === "friend_request" && payload.fromUserName) {
    return `Friend request from ${payload.fromUserName}`;
  }
  if (payload.type === "tab_invite" && payload.fromUserName && payload.tabName) {
    return `${payload.fromUserName} invited you to ${payload.tabName}`;
  }
  if (payload.type === "friend_request") return "New friend request";
  if (payload.type === "tab_invite") return "New tab invite";
  return "New notification";
}

function getPushBody(payload: { type: string; forcePush?: boolean }): string {
  if (payload.forcePush) return "This is a test notification";
  if (payload.type === "friend_request") return "New friend request";
  if (payload.type === "tab_invite") return "New tab invite";
  return "You have a new notification";
}

function getNavigatePath(payload: { type: string }): string {
  return payload.type === "tab_invite" ? "/app/tabs" : "/app/friends";
}

async function sendPushNotifications(userId: string, payload: unknown): Promise<void> {
  if (!vapidPublicKey || !vapidPrivateKey) return;

  const subs = await db
    .select()
    .from(pushSubscription)
    .where(eq(pushSubscription.userId, userId))
    .limit(10);

  if (subs.length === 0) return;

  const payloadObj = typeof payload === "string" ? JSON.parse(payload) : payload;
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

  await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        pushPayload,
        { TTL: 86400, urgency: "high" }
      )
    )
  );
}

redis.on("message", (channel, message) => {
  const match = channel.match(/^notifications:user:(.+)$/);
  if (match) {
    const userId = match[1];
    const payload = typeof message === "string" ? JSON.parse(message) : message;
    const connections = userConnections.get(userId);
    const hasConnections = connections && connections.size > 0;

    if (hasConnections) {
      connections!.forEach((conn) => {
        if (conn.readyState === 1) {
          conn.send(message);
        }
      });
    }
    sendPushNotifications(userId, message).catch((err) =>
      console.error("Push notification error:", err)
    );
  }
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const certDir = join(__dirname, "../../web/certificates");
const certPath = process.env.NOTIFICATIONS_WS_HTTPS_CERT ?? join(certDir, "cert.pem");
const keyPath = process.env.NOTIFICATIONS_WS_HTTPS_KEY ?? join(certDir, "key.pem");

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
      }
    );
    console.log("Notifications WebSocket server using HTTPS (WSS)");
  } catch {
    server = createHttpServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("Notifications WebSocket server");
    });
  }
} else {
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
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const [userId, timestampStr] = decoded.split(":");
    const timestamp = Number(timestampStr);

    if (!userId || !timestamp) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    const age = Date.now() - timestamp;
    if (age > 5 * 60 * 1000) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request, userId);
    });
  } catch {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
  }
});

wss.on("connection", (ws: WebSocket, _request: IncomingMessage, userId: string) => {
  if (!userConnections.has(userId)) {
    userConnections.set(userId, new Set());
    subscribeToUser(userId);
  }
  userConnections.get(userId)!.add(ws);

  ws.on("close", () => {
    const connections = userConnections.get(userId);
    if (connections) {
      connections.delete(ws);
      if (connections.size === 0) {
        userConnections.delete(userId);
        unsubscribeFromUser(userId);
      }
    }
  });
});

const port = Number(process.env.PORT ?? 3002);
server.listen(port, () => {
  console.log(`Notifications WebSocket server listening on port ${port}`);
});
