import { Hono } from "hono";
import { apiKeyData } from "data";
import type { AuthContext } from "../auth.js";
import { authMiddleware } from "../auth.js";

export const apiKeysRoutes = new Hono<{ Variables: { auth: AuthContext } }>();

apiKeysRoutes.use("*", authMiddleware);

apiKeysRoutes.get("/", async (c) => {
  const { userId } = c.get("auth");

  const keys = await apiKeyData.listByUserId(userId);

  return c.json({ success: true, keys });
});

apiKeysRoutes.post("/", async (c) => {
  const { userId } = c.get("auth");

  const body = await c.req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "API Key";

  const key = await apiKeyData.create(userId, name);

  return c.json({
    success: true,
    key: {
      id: key.id,
      keyPrefix: key.keyPrefix,
      name: key.name,
      createdAt: key.createdAt,
      rawKey: key.rawKey,
    },
  });
});

apiKeysRoutes.delete("/:id", async (c) => {
  const { userId } = c.get("auth");
  const id = c.req.param("id");

  await apiKeyData.delete(id, userId);

  return c.json({ success: true });
});
