import { db, pushSubscription } from "db";
import { eq, and } from "drizzle-orm";

export const push = {
  insert: async (params: {
    userId: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    userAgent?: string | null;
  }): Promise<void> => {
    await db.insert(pushSubscription).values({
      userId: params.userId,
      endpoint: params.endpoint,
      p256dh: params.p256dh,
      auth: params.auth,
      userAgent: params.userAgent,
    });
  },

  deleteByUserAndEndpoint: async (
    userId: string,
    endpoint: string,
  ): Promise<void> => {
    await db
      .delete(pushSubscription)
      .where(
        and(
          eq(pushSubscription.userId, userId),
          eq(pushSubscription.endpoint, endpoint),
        ),
      );
  },

  countByUserId: async (userId: string): Promise<number> => {
    const rows = await db
      .select({ id: pushSubscription.id })
      .from(pushSubscription)
      .where(eq(pushSubscription.userId, userId));
    return rows.length;
  },
};
