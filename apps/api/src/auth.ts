import { createMiddleware } from "hono/factory";
import { auth } from "auth";
import { db, apiKey } from "db";
import { eq } from "drizzle-orm";
import { createHash } from "node:crypto";

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
    const keyHash = createHash("sha256").update(apiKeyHeader).digest("hex");

    const [key] = await db
      .select()
      .from(apiKey)
      .where(eq(apiKey.keyHash, keyHash))
      .limit(1);

    if (key) {
      if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
        return c.json({ error: "API key expired" }, 401);
      }
      c.set("auth", { userId: key.userId, authType: "api_key" });
      return next();
    }
  }

  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session?.user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("auth", { userId: session.user.id, authType: "session" });
  return next();
});
