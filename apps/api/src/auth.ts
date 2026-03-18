import { createMiddleware } from "hono/factory";
import { auth } from "auth";
import { apiKeyData } from "data";
import { log } from "./lib/logger.js";

export type AuthContext = {
  userId: string;
  authType: "session" | "api_key";
};

export const authMiddleware = createMiddleware<{
  Variables: { auth: AuthContext };
}>(async (c, next) => {
  const apiKeyHeader =
    c.req.header("Authorization")?.replace(/^Bearer\s+/i, "") ??
    c.req.header("X-API-Key");

  if (apiKeyHeader) {
    const userId = await apiKeyData.getUserIdByKey(apiKeyHeader);
    if (userId) {
      c.set("auth", { userId, authType: "api_key" });
      return next();
    }
  }

  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session?.user) {
    log("warn", "Auth rejected: no valid session or API key");
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("auth", { userId: session.user.id, authType: "session" });
  return next();
});
