import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AuthContext } from "./auth.js";
import { log } from "./lib/logger.js";
import { friendsRoutes } from "./routes/friends.js";
import { tabInvitesRoutes } from "./routes/tab-invites.js";
import { tabsRoutes } from "./routes/tabs.js";
import { profileRoutes } from "./routes/profile.js";
import { usernameRoutes } from "./routes/username.js";
import { apiKeysRoutes } from "./routes/api-keys.js";
import { activityRoutes } from "./routes/activity.js";
import { pushRoutes } from "./routes/push.js";
import { authMiddleware } from "./auth.js";

const app = new Hono<{ Variables: { auth: AuthContext } }>();

const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:3000";
const origins = corsOrigin.split(",").map((o) => o.trim());

app.use(
  "*",
  cors({
    origin: origins,
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-API-Key"],
  })
);

app.use("*", async (c, next) => {
  const start = Date.now();
  try {
    await next();
  } catch (err) {
    log("error", "Request threw", { method: c.req.method, path: c.req.path, error: String(err) });
    throw err;
  }
  const duration = Date.now() - start;
  const status = c.res.status;
  const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
  log(level, "Request", { method: c.req.method, path: c.req.path, status, durationMs: duration });
});

app.get("/health", (c) => c.json({ status: "ok" }));

app.get("/notifications/token", authMiddleware, async (c) => {
  const { userId } = c.get("auth");
  const token = Buffer.from(`${userId}:${Date.now()}`).toString("base64url");
  return c.json({ token });
});

app.onError((err, c) => {
  log("error", "Unhandled error", { error: String(err), path: c.req.path });
  return c.json({ error: "Internal server error" }, 500);
});

app.route("/friends", friendsRoutes);
app.route("/tab-invites", tabInvitesRoutes);
app.route("/tabs", tabsRoutes);
app.route("/profile", profileRoutes);
app.route("/username", usernameRoutes);
app.route("/api-keys", apiKeysRoutes);
app.route("/activity", activityRoutes);
app.route("/push", pushRoutes);

const port = Number(process.env.PORT ?? 3001);
log("info", `API server listening on port ${port}`, { corsOrigins: origins });
serve({ fetch: app.fetch, port });
