import { ORPCError, os } from "@orpc/server";
import { auth } from "auth";
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

export const authed = base.use(requireAuth);
