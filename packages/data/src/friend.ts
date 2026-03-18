import {
  db,
  friendRequest,
  pendingFriend,
  tab as tabTable,
  tabMember,
  user as userTable,
} from "db";
import { eq, and, desc, inArray, ne, sql, ilike, gt } from "drizzle-orm";

export type FriendRequest = {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: string;
  createdAt: Date;
  fromUserUsername: string | null;
  fromUserName: string | null;
};

export type PendingFriend = {
  id: string;
  token: string;
  userId: string;
  expiresAt: Date;
};

export const friend = {
  getDirectTabBetween: async (
    userId1: string,
    userId2: string,
  ): Promise<string | null> => {
    const user1DirectTabs = await db
      .select({ tabId: tabMember.tabId })
      .from(tabTable)
      .innerJoin(tabMember, eq(tabTable.id, tabMember.tabId))
      .where(
        and(eq(tabTable.isDirect, true), eq(tabMember.userId, userId1)),
      );
    const tabIds = user1DirectTabs.map((d) => d.tabId);
    if (tabIds.length === 0) return null;
    const [existing] = await db
      .select({ tabId: tabMember.tabId })
      .from(tabMember)
      .where(
        and(inArray(tabMember.tabId, tabIds), eq(tabMember.userId, userId2)),
      )
      .limit(1);
    return existing?.tabId ?? null;
  },

  getMissedFriendRequests: async (
    toUserId: string,
    since: Date,
  ): Promise<
    Array<{
      id: string;
      fromUserId: string;
      fromUserUsername: string | null;
      fromUserName: string | null;
      createdAt: Date;
    }>
  > => {
    return db
      .select({
        id: friendRequest.id,
        fromUserId: friendRequest.fromUserId,
        fromUserUsername: userTable.username,
        fromUserName: userTable.name,
        createdAt: friendRequest.createdAt,
      })
      .from(friendRequest)
      .innerJoin(userTable, eq(friendRequest.fromUserId, userTable.id))
      .where(
        and(
          eq(friendRequest.toUserId, toUserId),
          eq(friendRequest.status, "pending"),
          gt(friendRequest.createdAt, since),
        ),
      )
      .orderBy(desc(friendRequest.createdAt));
  },

  getPendingRequests: async (userId: string): Promise<FriendRequest[]> => {
    const rows = await db
      .select({
        id: friendRequest.id,
        fromUserId: friendRequest.fromUserId,
        toUserId: friendRequest.toUserId,
        status: friendRequest.status,
        createdAt: friendRequest.createdAt,
        fromUserUsername: userTable.username,
        fromUserName: userTable.name,
      })
      .from(friendRequest)
      .innerJoin(userTable, eq(friendRequest.fromUserId, userTable.id))
      .where(
        and(
          eq(friendRequest.toUserId, userId),
          eq(friendRequest.status, "pending"),
        ),
      )
      .orderBy(desc(friendRequest.createdAt));
    return rows;
  },

  getRequestById: async (
    requestId: string,
    toUserId?: string,
  ): Promise<{
    id: string;
    fromUserId: string;
    toUserId: string;
    status: string;
  } | null> => {
    const conditions = [eq(friendRequest.id, requestId)];
    if (toUserId) {
      conditions.push(eq(friendRequest.toUserId, toUserId));
    }
    const [row] = await db
      .select()
      .from(friendRequest)
      .where(and(...conditions))
      .limit(1);
    return row ?? null;
  },

  getRequestByIdAndToUser: async (
    requestId: string,
    toUserId: string,
  ): Promise<{ id: string; fromUserId: string; toUserId: string; status: string } | null> => {
    const [row] = await db
      .select()
      .from(friendRequest)
      .where(
        and(
          eq(friendRequest.id, requestId),
          eq(friendRequest.toUserId, toUserId),
          eq(friendRequest.status, "pending"),
        ),
      )
      .limit(1);
    return row ?? null;
  },

  checkExistingRequest: async (
    fromUserId: string,
    toUserId: string,
    status: string = "pending",
  ): Promise<boolean> => {
    const [row] = await db
      .select({ id: friendRequest.id })
      .from(friendRequest)
      .where(
        and(
          eq(friendRequest.fromUserId, fromUserId),
          eq(friendRequest.toUserId, toUserId),
          eq(friendRequest.status, status),
        ),
      )
      .limit(1);
    return !!row;
  },

  checkReverseRequest: async (
    fromUserId: string,
    toUserId: string,
  ): Promise<boolean> => {
    const [row] = await db
      .select({ id: friendRequest.id })
      .from(friendRequest)
      .where(
        and(
          eq(friendRequest.fromUserId, fromUserId),
          eq(friendRequest.toUserId, toUserId),
          eq(friendRequest.status, "pending"),
        ),
      )
      .limit(1);
    return !!row;
  },

  createRequest: async (
    fromUserId: string,
    toUserId: string,
  ): Promise<{ id: string; createdAt: Date }> => {
    const [inserted] = await db
      .insert(friendRequest)
      .values({
        fromUserId,
        toUserId,
        status: "pending",
      })
      .returning({
        id: friendRequest.id,
        createdAt: friendRequest.createdAt,
      });
    return { id: inserted!.id, createdAt: inserted!.createdAt };
  },

  updateRequestStatus: async (
    requestId: string,
    status: "accepted" | "rejected",
  ): Promise<void> => {
    await db
      .update(friendRequest)
      .set({ status })
      .where(eq(friendRequest.id, requestId));
  },

  updateRequestStatusForToUser: async (
    requestId: string,
    toUserId: string,
    status: "accepted" | "rejected",
  ): Promise<void> => {
    await db
      .update(friendRequest)
      .set({ status })
      .where(
        and(
          eq(friendRequest.id, requestId),
          eq(friendRequest.toUserId, toUserId),
        ),
      );
  },

  getPendingFriendByToken: async (
    token: string,
  ): Promise<PendingFriend | null> => {
    const [row] = await db
      .select()
      .from(pendingFriend)
      .where(
        and(
          eq(pendingFriend.token, token.trim()),
          sql`${pendingFriend.expiresAt} > NOW()`,
        ),
      )
      .limit(1);
    return row ?? null;
  },

  getPendingFriendByUser: async (
    userId: string,
  ): Promise<PendingFriend | null> => {
    const [row] = await db
      .select()
      .from(pendingFriend)
      .where(
        and(
          eq(pendingFriend.userId, userId),
          sql`${pendingFriend.expiresAt} > NOW()`,
        ),
      )
      .limit(1);
    return row ?? null;
  },

  createPendingFriend: async (
    token: string,
    userId: string,
    expiresAt: Date,
  ): Promise<void> => {
    await db.insert(pendingFriend).values({
      token,
      userId,
      expiresAt,
    });
  },

  deletePendingFriend: async (id: string): Promise<void> => {
    await db.delete(pendingFriend).where(eq(pendingFriend.id, id));
  },

  searchUsers: async (
    query: string,
    excludeUserIds: string[],
    limit: number = 10,
  ): Promise<Array<{ id: string; username: string | null; name: string | null }>> => {
    const trimmed = query.trim().toLowerCase();
    if (trimmed.length < 3) return [];
    const rows = await db
      .select({
        id: userTable.id,
        username: userTable.username,
        name: userTable.name,
      })
      .from(userTable)
      .where(ilike(userTable.username, `%${trimmed}%`))
      .limit(limit);
    return rows.filter((u) => !excludeUserIds.includes(u.id));
  },

  getDirectTabIdsForUser: async (userId: string): Promise<string[]> => {
    const rows = await db
      .select({ tabId: tabMember.tabId })
      .from(tabTable)
      .innerJoin(tabMember, eq(tabTable.id, tabMember.tabId))
      .where(
        and(eq(tabTable.isDirect, true), eq(tabMember.userId, userId)),
      );
    return rows.map((r) => r.tabId);
  },

  getOtherMemberOfDirectTab: async (
    tabId: string,
    userId: string,
  ): Promise<string | null> => {
    const [row] = await db
      .select({ userId: tabMember.userId })
      .from(tabMember)
      .where(
        and(eq(tabMember.tabId, tabId), ne(tabMember.userId, userId)),
      )
      .limit(1);
    return row?.userId ?? null;
  },

  isUserInDirectTab: async (
    tabId: string,
    userId: string,
  ): Promise<boolean> => {
    const [row] = await db
      .select()
      .from(tabTable)
      .innerJoin(tabMember, eq(tabTable.id, tabMember.tabId))
      .where(
        and(
          eq(tabTable.id, tabId),
          eq(tabTable.isDirect, true),
          eq(tabMember.userId, userId),
        ),
      )
      .limit(1);
    return !!row;
  },
};
