import { db, apiKey } from "db";
import { eq, and } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";

export type ApiKeySummary = {
  id: string;
  keyPrefix: string;
  name: string;
  createdAt: Date;
  expiresAt: Date | null;
};

export type ApiKeyCreated = {
  id: string;
  keyPrefix: string;
  name: string;
  createdAt: Date;
  rawKey: string;
};

export const apiKeyData = {
  getUserIdByKey: async (rawKey: string): Promise<string | null> => {
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const [key] = await db
      .select({ userId: apiKey.userId, expiresAt: apiKey.expiresAt })
      .from(apiKey)
      .where(eq(apiKey.keyHash, keyHash))
      .limit(1);
    if (!key) return null;
    if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
      return null;
    }
    return key.userId;
  },

  listByUserId: async (userId: string): Promise<ApiKeySummary[]> => {
    return db
      .select({
        id: apiKey.id,
        keyPrefix: apiKey.keyPrefix,
        name: apiKey.name,
        createdAt: apiKey.createdAt,
        expiresAt: apiKey.expiresAt,
      })
      .from(apiKey)
      .where(eq(apiKey.userId, userId));
  },

  create: async (
    userId: string,
    name: string = "API Key",
  ): Promise<ApiKeyCreated> => {
    const rawKey = `tab_${randomBytes(24).toString("base64url")}`;
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
      .returning({
        id: apiKey.id,
        keyPrefix: apiKey.keyPrefix,
        name: apiKey.name,
        createdAt: apiKey.createdAt,
      });

    if (!inserted) throw new Error("Failed to create API key");
    return {
      id: inserted.id,
      keyPrefix: inserted.keyPrefix,
      name: inserted.name,
      createdAt: inserted.createdAt,
      rawKey,
    };
  },

  delete: async (id: string, userId: string): Promise<void> => {
    await db
      .delete(apiKey)
      .where(and(eq(apiKey.id, id), eq(apiKey.userId, userId)));
  },
};
