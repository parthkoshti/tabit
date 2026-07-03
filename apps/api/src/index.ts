import "./instrumentation.js";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { RPCHandler } from "@orpc/server/fetch";
import { CORSPlugin } from "@orpc/server/plugins";
import { auth } from "auth";
import { appRouter, type RpcContext } from "rpc";
import { resolveCorsOrigins } from "shared";
import { SLOW_RPC_MS } from "otel";
import { log } from "./lib/logger.js";

const app = new Hono();

const origins = resolveCorsOrigins();

app.use(
  "*",
  cors({
    origin: origins,
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "Cookie",
      "Accept",
      "Origin",
      "X-Requested-With",
    ],
  }),
);

app.use("*", async (c, next) => {
  const start = Date.now();
  try {
    await next();
  } catch (err) {
    log("error", "Request threw", {
      method: c.req.method,
      path: c.req.path,
      error: String(err),
    });
    throw err;
  }
  const duration = Date.now() - start;
  const status = c.res.status;
  const isRpc = c.req.path.startsWith("/rpc/");
  const isSlow = duration >= SLOW_RPC_MS;
  const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";

  // RPC middleware owns logging for /rpc/* (including slow + errors).
  if (isRpc) return;

  if (status >= 400 || isSlow) {
    const summary = `${c.req.method} ${c.req.path} ${status} ${duration}ms`;
    log(level, summary, {
      method: c.req.method,
      path: c.req.path,
      status,
      durationMs: duration,
    });
  }
});

app.get("/health", (c) => c.json({ status: "ok" }));

app.on(["GET", "POST"], "/api/auth/*", async (c) => auth.handler(c.req.raw));

const rpcHandler = new RPCHandler(appRouter, {
  plugins: [new CORSPlugin()],
});

const BODY_PARSER_METHODS = new Set([
  "arrayBuffer",
  "blob",
  "formData",
  "json",
  "text",
] as const);

type BodyParserMethod = (typeof BODY_PARSER_METHODS extends Set<infer T>
  ? T
  : never) &
  string;

app.use("/rpc/*", async (c, next) => {
  const request = new Proxy(c.req.raw, {
    get(target, prop) {
      if (BODY_PARSER_METHODS.has(prop as BodyParserMethod)) {
        return () =>
          c.req[prop as "json" | "text" | "arrayBuffer" | "blob" | "formData"]();
      }
      return Reflect.get(target, prop, target);
    },
  });

  const context: RpcContext = { headers: c.req.raw.headers };

  const { matched, response } = await rpcHandler.handle(request, {
    prefix: "/rpc",
    context,
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  await next();
});

app.onError((err, c) => {
  log("error", "Unhandled error", { error: String(err), path: c.req.path });
  return c.json({ error: "Internal server error" }, 500);
});

const port = Number(process.env.PORT ?? 3001);
log("info", `API server listening on port ${port}`, { corsOrigins: origins });
serve({ fetch: app.fetch, port });
