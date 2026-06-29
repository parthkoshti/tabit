import { ORPCError, os } from "@orpc/server";
import { auth } from "auth";
import { log, withSpan } from "otel";
import type { RpcContext } from "./context.js";

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
  async ({ context, next, path }) => {
    const start = Date.now();
    const procedure = path.join(".");
    try {
      return await withSpan(
        `rpc.${procedure}`,
        {
          "rpc.procedure": procedure,
          "user.id": context.userId,
        },
        async (span) => {
          log("info", "RPC call started", {
            operation: "rpc.call",
            action: "start",
            procedure,
            userId: context.userId,
          });
          const result = await next();
          const durationMs = Date.now() - start;
          span.setAttribute("rpc.duration_ms", durationMs);
          log("info", "RPC call completed", {
            operation: "rpc.call",
            action: "complete",
            procedure,
            userId: context.userId,
            durationMs,
          });
          return result;
        },
      );
    } catch (err) {
      log("error", "RPC error", {
        operation: "rpc.call",
        action: "error",
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
