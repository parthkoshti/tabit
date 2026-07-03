import { ORPCError, os } from "@orpc/server";
import { auth } from "auth";
import { debug, log, spanEvent, SLOW_RPC_MS, withSpan } from "otel";
import type { RpcContext } from "./context.js";
import { annotateSpanFromInput, tabIdFromInput } from "./span-input.js";

export const base = os.$context<RpcContext>();

export const requireAuth = base.middleware(async ({ context, next }) => {
  const session = await auth.api.getSession({ headers: context.headers });
  if (!session?.user) {
    throw new ORPCError("UNAUTHORIZED", { message: "Unauthorized" });
  }
  return next({
    context: {
      ...context,
      userId: session.user.id,
    },
  });
});

const withProcedureLog = base.middleware(
  async ({ context, next, path }, input) => {
    const start = Date.now();
    const procedure = path.join(".");
    annotateSpanFromInput(input);
    const tabId = tabIdFromInput(input);
    try {
      return await withSpan(
        `rpc.${procedure}`,
        {
          "rpc.system": "orpc",
          "rpc.method": procedure,
          "enduser.id": context.userId ?? "anonymous",
          ...(tabId ? { "tab.id": tabId } : {}),
        },
        async (span) => {
          spanEvent("rpc.start");
          debug("RPC call started", {
            operation: "rpc.call",
            procedure,
            userId: context.userId,
            tabId,
          });
          const result = await next();
          const durationMs = Date.now() - start;
          span.setAttribute("rpc.duration_ms", durationMs);
          spanEvent("rpc.complete", { durationMs });
          const tabSuffix = tabId ? ` tab:${tabId}` : "";
          if (durationMs >= SLOW_RPC_MS) {
            log("warn", `Slow RPC ${procedure}${tabSuffix} ${durationMs}ms`, {
              operation: "rpc.call",
              procedure,
              userId: context.userId,
              tabId,
              durationMs,
            });
          } else {
            debug("RPC call completed", {
              operation: "rpc.call",
              procedure,
              userId: context.userId,
              durationMs,
            });
          }
          return result;
        },
      );
    } catch (err) {
      log("error", `RPC error ${procedure} ${Date.now() - start}ms`, {
        operation: "rpc.call",
        procedure,
        userId: context.userId,
        error: err instanceof Error ? err.message : String(err),
        errorName: err instanceof Error ? err.name : undefined,
        stack: err instanceof Error ? err.stack?.slice(0, 500) : undefined,
        durationMs: Date.now() - start,
      });
      throw err;
    }
  },
);

export const authed = base.use(requireAuth).use(withProcedureLog);
