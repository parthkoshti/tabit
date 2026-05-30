import "./instrumentation.js";
import { createServer as createHttpServer, type Server } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cron from "node-cron";
import { Server as SocketIOServer } from "socket.io";
import { auth } from "auth";
import { warmLatestRatesForBases, recurringExpenseService } from "services";
import { createNotificationsWorker, type NotificationJobData } from "queue";
import type { NotificationPayload } from "models";
import { sendDiscordWebhook } from "shared";
import { log as otelLog } from "otel";
import { sendPushNotifications } from "./push-delivery.js";

const LOG_PREFIX = "[workers]";

function log(
  level: "info" | "warn" | "error",
  msg: string,
  data?: Record<string, unknown>,
) {
  otelLog(level, `${LOG_PREFIX} ${msg}`, data);
}

const corsOrigin = process.env.CORS_ORIGIN ?? "https://app.tabit.in";
const corsOrigins = corsOrigin.split(",").map((o) => o.trim());

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const certDir = path.resolve(moduleDir, "../../../certs");
const certPath = path.join(certDir, "cert.pem");
const keyPath = path.join(certDir, "key.pem");
const tls =
  fs.existsSync(certPath) && fs.existsSync(keyPath)
    ? {
        cert: fs.readFileSync(certPath),
        key: fs.readFileSync(keyPath),
      }
    : null;

const httpServer: Server = tls
  ? createHttpsServer(tls)
  : createHttpServer();

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: corsOrigins,
    credentials: true,
  },
});

httpServer.on("request", (req, res) => {
  const pathname = req.url?.split("?")[0] ?? "";
  if (pathname.startsWith("/socket.io")) return;

  if (pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Tab workers");
});

io.use(async (socket, next) => {
  try {
    const cookie = socket.handshake.headers.cookie;
    const headers = new Headers();
    if (cookie) headers.set("cookie", cookie);
    const session = await auth.api.getSession({ headers });
    if (!session?.user) {
      log("warn", "Socket.IO auth rejected", {
        hasCookie: Boolean(cookie),
        socketId: socket.id,
      });
      return next(new Error("Unauthorized"));
    }
    socket.data.userId = session.user.id;
    next();
  } catch (err) {
    next(err instanceof Error ? err : new Error(String(err)));
  }
});

io.on("connection", (socket) => {
  const userId = socket.data.userId as string;
  void socket.join(`user:${userId}`);
  log("info", "Socket.IO client connected", { userId, socketId: socket.id });

  socket.on("disconnect", () => {
    log("info", "Socket.IO client disconnected", {
      userId,
      socketId: socket.id,
    });
  });
});

async function deliverNotification(
  userId: string,
  payload: NotificationPayload,
  forcePush?: boolean,
): Promise<void> {
  io.to(`user:${userId}`).emit("notification", payload);

  const { removedInvalidSubscriptions } = await sendPushNotifications(
    userId,
    payload,
    { forcePush },
  );

  if (removedInvalidSubscriptions) {
    io.to(`user:${userId}`).emit("notification", {
      type: "push_resubscription_required",
    });
  }
}

createNotificationsWorker(async (job) => {
  const { userId, payload, forcePush } = job.data as NotificationJobData;
  log("info", "Processing notification job", {
    userId,
    type: payload.type,
    jobId: job.id,
  });
  await deliverNotification(userId, payload, forcePush);
});

cron.schedule(
  "0 16 * * *",
  () => {
    void warmLatestRatesForBases(["EUR", "USD"]).catch((e) => {
      const msg = `FX warm cron failed: ${String(e)}`;
      log("error", msg);
      sendDiscordWebhook(msg);
    });
  },
  { timezone: "Europe/Berlin" },
);

cron.schedule("*/15 * * * *", () => {
  void recurringExpenseService.runTick().catch((e) => {
    const msg = `recurringExpenseService.runTick failed: ${String(e)}`;
    log("error", msg);
    sendDiscordWebhook(msg);
  });
});

const port = Number(process.env.PORT ?? 3002);
httpServer.listen(port, () => {
  log("info", `Workers listening on port ${port}`, {
    tls: tls ? "https" : "http",
  });
  void warmLatestRatesForBases(["EUR", "USD"]).catch((e) => {
    log("error", "Startup FX warm failed", { error: String(e) });
  });
});
