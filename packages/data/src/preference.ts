import { db, userPreference } from "db";
import { eq, and } from "drizzle-orm";

export const preference = {
  getByUserId: async (userId: string): Promise<Array<{ key: string; value: string }>> => {
    const rows = await db
      .select()
      .from(userPreference)
      .where(eq(userPreference.userId, userId));
    return rows;
  },

  upsert: async (
    userId: string,
    key: string,
    value: string,
  ): Promise<void> => {
    await db
      .insert(userPreference)
      .values({
        userId,
        key,
        value,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [userPreference.userId, userPreference.key],
        set: { value, updatedAt: new Date() },
      });
  },

  delete: async (userId: string, key: string): Promise<void> => {
    await db
      .delete(userPreference)
      .where(
        and(
          eq(userPreference.userId, userId),
          eq(userPreference.key, key),
        ),
      );
  },
};
