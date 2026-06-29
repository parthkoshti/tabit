import { ORPCError, os } from "@orpc/server";
import { auth } from "auth";
import { log } from "otel";
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
    try {
      const result = await next();
      log("info", "RPC call", {
        procedure: path.join("."),
        userId: context.userId,
        durationMs: Date.now() - start,
      });
      return result;
    } catch (err) {
      log("error", "RPC error", {
        procedure: path.join("."),
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
