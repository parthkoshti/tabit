import { Hono } from "hono";
import { db, apiKey } from "db";
import { eq, and } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import type { AuthContext } from "../auth.js";
import { authMiddleware } from "../auth.js";

function generateKey(): string {
  return `tab_${randomBytes(24).toString("base64url")}`;
}

export const apiKeysRoutes = new Hono<{ Variables: { auth: AuthContext } }>();

apiKeysRoutes.use("*", authMiddleware);

apiKeysRoutes.get("/", async (c) => {
  const { userId } = c.get("auth");

  const keys = await db
    .select({
      id: apiKey.id,
      keyPrefix: apiKey.keyPrefix,
      name: apiKey.name,
      createdAt: apiKey.createdAt,
      expiresAt: apiKey.expiresAt,
    })
    .from(apiKey)
    .where(eq(apiKey.userId, userId));

  return c.json({ success: true, keys });
});

apiKeysRoutes.post("/", async (c) => {
  const { userId } = c.get("auth");

  const body = await c.req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "API Key";

  const rawKey = generateKey();
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.slice(0, 8);

  const [inserted] = await db
    .insert(apiKey)
    .values({
      userId,
      keyHash,
      keyPrefix,
      name,
    })
    .returning({ id: apiKey.id, keyPrefix: apiKey.keyPrefix, name: apiKey.name, createdAt: apiKey.createdAt });

  return c.json({
    success: true,
    key: {
      id: inserted!.id,
      keyPrefix: inserted!.keyPrefix,
      name: inserted!.name,
      createdAt: inserted!.createdAt,
      rawKey,
    },
  });
});

apiKeysRoutes.delete("/:id", async (c) => {
  const { userId } = c.get("auth");
  const id = c.req.param("id");

  await db
    .delete(apiKey)
    .where(and(eq(apiKey.id, id), eq(apiKey.userId, userId)));

  return c.json({ success: true });
});
