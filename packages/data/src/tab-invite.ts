import {
  db,
  tab,
  tabMember,
  user,
  tabInviteRequest,
  pendingTabInvite,
} from "db";
import { eq, and, desc, sql, gt } from "drizzle-orm";
import { createId } from "shared";

export type PendingTabInviteByToken = {
  tabId: string;
  createdByUserId: string;
};

export type TabInviteRequestRow = {
  id: string;
  tabId: string;
  fromUserId: string;
  toUserId: string;
  status: string;
  createdAt: Date;
};

export type TabInviteRequestWithDetails = {
  id: string;
  tabId: string;
  fromUserId: string;
  tabName: string;
  fromUserName: string | null;
  fromUserUsername: string | null;
  createdAt: Date;
};

export const tabInvite = {
  getPendingByToken: async (
    token: string,
  ): Promise<PendingTabInviteByToken | null> => {
    const [row] = await db
      .select({
        tabId: pendingTabInvite.tabId,
        createdByUserId: pendingTabInvite.createdByUserId,
      })
      .from(pendingTabInvite)
      .where(
        and(
          eq(pendingTabInvite.token, token.trim()),
          sql`${pendingTabInvite.expiresAt} > NOW()`,
        ),
      )
      .limit(1);
    return row ?? null;
  },

  getTabById: async (tabId: string) => {
    const [row] = await db
      .select({ id: tab.id, name: tab.name })
      .from(tab)
      .where(eq(tab.id, tabId))
      .limit(1);
    return row ?? null;
  },

  getUserById: async (userId: string) => {
    const [row] = await db
      .select({ id: user.id, name: user.name, username: user.username })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return row ?? null;
  },

  isMember: async (tabId: string, userId: string): Promise<boolean> => {
    const [row] = await db
      .select()
      .from(tabMember)
      .where(
        and(eq(tabMember.tabId, tabId), eq(tabMember.userId, userId)),
      )
      .limit(1);
    return !!row;
  },

  getMembers: async (tabId: string): Promise<{ userId: string }[]> => {
    return db
      .select({ userId: tabMember.userId })
      .from(tabMember)
      .where(eq(tabMember.tabId, tabId));
  },

  addMember: async (
    tabId: string,
    userId: string,
    role: "member" = "member",
  ): Promise<void> => {
    await db.insert(tabMember).values({
      tabId,
      userId,
      role,
    });
  },

  getPendingInviteByToken: async (token: string) => {
    const [row] = await db
      .select()
      .from(pendingTabInvite)
      .where(
        and(
          eq(pendingTabInvite.token, token),
          sql`${pendingTabInvite.expiresAt} > NOW()`,
        ),
      )
      .limit(1);
    return row ?? null;
  },

  deletePendingInvite: async (id: string): Promise<void> => {
    await db.delete(pendingTabInvite).where(eq(pendingTabInvite.id, id));
  },

  deletePendingInvitesByTabAndCreator: async (
    tabId: string,
    createdByUserId: string,
  ): Promise<void> => {
    await db
      .delete(pendingTabInvite)
      .where(
        and(
          eq(pendingTabInvite.tabId, tabId),
          eq(pendingTabInvite.createdByUserId, createdByUserId),
        ),
      );
  },

  getExistingPendingByTabAndCreator: async (
    tabId: string,
    createdByUserId: string,
  ) => {
    const [row] = await db
      .select()
      .from(pendingTabInvite)
      .where(
        and(
          eq(pendingTabInvite.tabId, tabId),
          eq(pendingTabInvite.createdByUserId, createdByUserId),
          sql`${pendingTabInvite.expiresAt} > NOW()`,
        ),
      )
      .limit(1);
    return row ?? null;
  },

  createPendingInvite: async (params: {
    token: string;
    tabId: string;
    createdByUserId: string;
    expiresAt: Date;
  }): Promise<void> => {
    await db.insert(pendingTabInvite).values({
      token: params.token,
      tabId: params.tabId,
      createdByUserId: params.createdByUserId,
      expiresAt: params.expiresAt,
    });
  },

  getPendingRequests: async (
    toUserId: string,
  ): Promise<TabInviteRequestWithDetails[]> => {
    return db
      .select({
        id: tabInviteRequest.id,
        tabId: tabInviteRequest.tabId,
        fromUserId: tabInviteRequest.fromUserId,
        tabName: tab.name,
        fromUserName: user.name,
        fromUserUsername: user.username,
        createdAt: tabInviteRequest.createdAt,
      })
      .from(tabInviteRequest)
      .innerJoin(tab, eq(tabInviteRequest.tabId, tab.id))
      .innerJoin(user, eq(tabInviteRequest.fromUserId, user.id))
      .where(
        and(
          eq(tabInviteRequest.toUserId, toUserId),
          eq(tabInviteRequest.status, "pending"),
        ),
      )
      .orderBy(desc(tabInviteRequest.createdAt));
  },

  getRequestByIdAndToUser: async (
    requestId: string,
    toUserId: string,
  ): Promise<TabInviteRequestRow | null> => {
    const [row] = await db
      .select()
      .from(tabInviteRequest)
      .where(
        and(
          eq(tabInviteRequest.id, requestId),
          eq(tabInviteRequest.toUserId, toUserId),
          eq(tabInviteRequest.status, "pending"),
        ),
      )
      .limit(1);
    return row ?? null;
  },

  updateRequestStatus: async (
    requestId: string,
    status: "accepted" | "rejected",
  ): Promise<void> => {
    await db
      .update(tabInviteRequest)
      .set({ status })
      .where(eq(tabInviteRequest.id, requestId));
  },

  checkExistingRequest: async (
    tabId: string,
    toUserId: string,
  ): Promise<boolean> => {
    const [row] = await db
      .select()
      .from(tabInviteRequest)
      .where(
        and(
          eq(tabInviteRequest.tabId, tabId),
          eq(tabInviteRequest.toUserId, toUserId),
          eq(tabInviteRequest.status, "pending"),
        ),
      )
      .limit(1);
    return !!row;
  },

  createRequest: async (params: {
    tabId: string;
    fromUserId: string;
    toUserId: string;
  }): Promise<{ id: string; createdAt: Date }> => {
    const [inserted] = await db
      .insert(tabInviteRequest)
      .values({
        tabId: params.tabId,
        fromUserId: params.fromUserId,
        toUserId: params.toUserId,
        status: "pending",
      })
      .returning({
        id: tabInviteRequest.id,
        createdAt: tabInviteRequest.createdAt,
      });
    if (!inserted) throw new Error("Failed to create tab invite request");
    return { id: inserted.id, createdAt: inserted.createdAt };
  },

  generateToken: (): string => createId(),

  getMissedTabInvites: async (
    toUserId: string,
    since: Date,
  ): Promise<
    Array<{
      id: string;
      tabId: string;
      tabName: string;
      fromUserId: string;
      fromUserUsername: string | null;
      fromUserName: string | null;
      createdAt: Date;
    }>
  > => {
    return db
      .select({
        id: tabInviteRequest.id,
        tabId: tabInviteRequest.tabId,
        tabName: tab.name,
        fromUserId: tabInviteRequest.fromUserId,
        fromUserUsername: user.username,
        fromUserName: user.name,
        createdAt: tabInviteRequest.createdAt,
      })
      .from(tabInviteRequest)
      .innerJoin(tab, eq(tabInviteRequest.tabId, tab.id))
      .innerJoin(user, eq(tabInviteRequest.fromUserId, user.id))
      .where(
        and(
          eq(tabInviteRequest.toUserId, toUserId),
          eq(tabInviteRequest.status, "pending"),
          gt(tabInviteRequest.createdAt, since),
        ),
      )
      .orderBy(desc(tabInviteRequest.createdAt));
  },
};
