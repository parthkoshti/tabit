import { db, user as userTable } from "db";
import { eq, inArray } from "drizzle-orm";

export type User = {
  id: string;
  name: string | null;
  username: string | null;
  email: string;
  defaultCurrency: string | null;
};

export const user = {
  getById: async (userId: string): Promise<User | null> => {
    const [row] = await db
      .select({
        id: userTable.id,
        name: userTable.name,
        username: userTable.username,
        email: userTable.email,
        defaultCurrency: userTable.defaultCurrency,
      })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);
    return row ?? null;
  },

  getByUsername: async (username: string): Promise<User | null> => {
    const [row] = await db
      .select({
        id: userTable.id,
        name: userTable.name,
        username: userTable.username,
        email: userTable.email,
        defaultCurrency: userTable.defaultCurrency,
      })
      .from(userTable)
      .where(eq(userTable.username, username.trim().toLowerCase()))
      .limit(1);
    return row ?? null;
  },

  getByEmail: async (email: string): Promise<User | null> => {
    const [row] = await db
      .select({
        id: userTable.id,
        name: userTable.name,
        username: userTable.username,
        email: userTable.email,
        defaultCurrency: userTable.defaultCurrency,
      })
      .from(userTable)
      .where(eq(userTable.email, email))
      .limit(1);
    return row ?? null;
  },

  getDefaultCurrency: async (userId: string): Promise<string> => {
    const [row] = await db
      .select({ defaultCurrency: userTable.defaultCurrency })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);
    return row?.defaultCurrency ?? "USD";
  },

  getByIds: async (
    userIds: string[],
  ): Promise<Array<{ id: string; name: string | null; username: string | null }>> => {
    if (userIds.length === 0) return [];
    const rows = await db
      .select({
        id: userTable.id,
        name: userTable.name,
        username: userTable.username,
      })
      .from(userTable)
      .where(inArray(userTable.id, userIds));
    return rows;
  },

  updateProfile: async (
    userId: string,
    updates: { name?: string | null; defaultCurrency?: string | null },
  ): Promise<void> => {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.name !== undefined) set.name = updates.name;
    if (updates.defaultCurrency !== undefined) set.defaultCurrency = updates.defaultCurrency;
    const hasUpdates = "name" in updates || "defaultCurrency" in updates;
    if (!hasUpdates) return;
    await db.update(userTable).set(set).where(eq(userTable.id, userId));
  },

  updateUsername: async (userId: string, username: string): Promise<void> => {
    await db
      .update(userTable)
      .set({ username, updatedAt: new Date() })
      .where(eq(userTable.id, userId));
  },

  getUsername: async (userId: string): Promise<string | null> => {
    const [row] = await db
      .select({ username: userTable.username })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);
    return row?.username ?? null;
  },

  getByUsernameForId: async (username: string): Promise<string | null> => {
    const [row] = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.username, username))
      .limit(1);
    return row?.id ?? null;
  },
};
