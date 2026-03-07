"use server";

import {
  db,
  tab,
  tabMember,
  user,
  pendingTabInvite,
  tabInviteRequest,
} from "db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, and, sql, desc } from "drizzle-orm";
import { createId } from "shared";

function secureToken(): string {
  return createId();
}

async function createDirectTab(userId1: string, userId2: string): Promise<string> {
  const [inserted] = await db
    .insert(tab)
    .values({ name: "Direct", isDirect: true })
    .returning({ id: tab.id });
  const id = inserted!.id;
  await db.insert(tabMember).values([
    { tabId: id, userId: userId1, role: "member" },
    { tabId: id, userId: userId2, role: "member" },
  ]);
  return id;
}

async function getOrCreateDirectTab(
  userId1: string,
  userId2: string
): Promise<string> {
  const directTabs = await db
    .select({ id: tab.id })
    .from(tab)
    .innerJoin(tabMember, eq(tab.id, tabMember.tabId))
    .where(and(eq(tab.isDirect, true), eq(tabMember.userId, userId1)));

  for (const t of directTabs) {
    const [other] = await db
      .select()
      .from(tabMember)
      .where(
        and(
          eq(tabMember.tabId, t.id),
          eq(tabMember.userId, userId2)
        )
      )
      .limit(1);
    if (other) return t.id;
  }

  return createDirectTab(userId1, userId2);
}

async function addUserToTabAndCreateFriendships(
  userId: string,
  tabId: string
): Promise<void> {
  const members = await db
    .select({ userId: tabMember.userId })
    .from(tabMember)
    .where(eq(tabMember.tabId, tabId));

  await db.insert(tabMember).values({
    tabId,
    userId,
    role: "member",
  });

  for (const m of members) {
    if (m.userId !== userId) {
      await getOrCreateDirectTab(userId, m.userId);
    }
  }
}

export async function getTabInviteToken(tabId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { success: false, error: "Unauthorized", url: null };
  }

  const [member] = await db
    .select()
    .from(tabMember)
    .where(
      and(
        eq(tabMember.tabId, tabId),
        eq(tabMember.userId, session.user.id)
      )
    )
    .limit(1);

  if (!member) {
    return { success: false, error: "Not a member of this tab", url: null };
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const [existing] = await db
    .select()
    .from(pendingTabInvite)
    .where(
      and(
        eq(pendingTabInvite.tabId, tabId),
        eq(pendingTabInvite.createdByUserId, session.user.id),
        sql`${pendingTabInvite.expiresAt} > NOW()`
      )
    )
    .limit(1);

  let token: string;
  if (existing) {
    token = existing.token;
  } else {
    await db
      .delete(pendingTabInvite)
      .where(
        and(
          eq(pendingTabInvite.tabId, tabId),
          eq(pendingTabInvite.createdByUserId, session.user.id)
        )
      );
    token = secureToken();
    for (let i = 0; i < 5; i++) {
      try {
        await db.insert(pendingTabInvite).values({
          token,
          tabId,
          createdByUserId: session.user.id,
          expiresAt,
        });
        break;
      } catch {
        token = secureToken();
        if (i === 4) throw new Error("Failed to generate invite token");
      }
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const url = `${baseUrl}/invite?type=tab&token=${encodeURIComponent(token)}`;

  return { success: true, url };
}

export async function getTabInviteByToken(token: string) {
  if (!token?.trim()) {
    return { success: false, error: "Invalid token", tab: null, creator: null };
  }

  const [pending] = await db
    .select({
      tabId: pendingTabInvite.tabId,
      createdByUserId: pendingTabInvite.createdByUserId,
    })
    .from(pendingTabInvite)
    .where(
      and(
        eq(pendingTabInvite.token, token.trim()),
        sql`${pendingTabInvite.expiresAt} > NOW()`
      )
    )
    .limit(1);

  if (!pending) {
    return { success: false, error: "Invalid or expired link", tab: null, creator: null };
  }

  const [tabRow] = await db
    .select({ id: tab.id, name: tab.name })
    .from(tab)
    .where(eq(tab.id, pending.tabId))
    .limit(1);

  const [creator] = await db
    .select({ id: user.id, name: user.name, username: user.username })
    .from(user)
    .where(eq(user.id, pending.createdByUserId))
    .limit(1);

  if (!tabRow || !creator) {
    return { success: false, error: "Tab or creator not found", tab: null, creator: null };
  }

  return {
    success: true,
    tab: tabRow,
    creator,
    tabId: pending.tabId,
  };
}

export async function joinTabByToken(token: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { success: false, error: "Unauthorized", redirectToLogin: true, tabId: null };
  }

  const result = await getTabInviteByToken(token);
  if (!result.success || !result.tabId) {
    return {
      success: false,
      error: result.error ?? "Invalid token",
      redirectToLogin: false,
      tabId: null,
    };
  }

  const [existing] = await db
    .select()
    .from(tabMember)
    .where(
      and(
        eq(tabMember.tabId, result.tabId),
        eq(tabMember.userId, session.user.id)
      )
    )
    .limit(1);

  if (existing) {
    const [pending] = await db
      .select()
      .from(pendingTabInvite)
      .where(eq(pendingTabInvite.token, token.trim()))
      .limit(1);
    if (pending) {
      await db.delete(pendingTabInvite).where(eq(pendingTabInvite.id, pending.id));
    }
    return {
      success: true,
      tabId: result.tabId,
      alreadyMember: true,
    };
  }

  await addUserToTabAndCreateFriendships(session.user.id, result.tabId);

  const [pending] = await db
    .select()
    .from(pendingTabInvite)
    .where(eq(pendingTabInvite.token, token.trim()))
    .limit(1);
  if (pending) {
    await db.delete(pendingTabInvite).where(eq(pendingTabInvite.id, pending.id));
  }

  return { success: true, tabId: result.tabId };
}

export async function sendTabInviteRequest(tabId: string, username: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  const [member] = await db
    .select()
    .from(tabMember)
    .where(
      and(
        eq(tabMember.tabId, tabId),
        eq(tabMember.userId, session.user.id)
      )
    )
    .limit(1);

  if (!member) {
    return { success: false, error: "Not a member of this tab" };
  }

  const [targetUser] = await db
    .select()
    .from(user)
    .where(eq(user.username, username.trim().toLowerCase()))
    .limit(1);

  if (!targetUser) {
    return { success: false, error: "User not found" };
  }

  if (targetUser.id === session.user.id) {
    return { success: false, error: "You cannot invite yourself" };
  }

  const [existingMember] = await db
    .select()
    .from(tabMember)
    .where(
      and(
        eq(tabMember.tabId, tabId),
        eq(tabMember.userId, targetUser.id)
      )
    )
    .limit(1);

  if (existingMember) {
    return { success: false, error: "User is already a member" };
  }

  const [existingRequest] = await db
    .select()
    .from(tabInviteRequest)
    .where(
      and(
        eq(tabInviteRequest.tabId, tabId),
        eq(tabInviteRequest.toUserId, targetUser.id),
        eq(tabInviteRequest.status, "pending")
      )
    )
    .limit(1);

  if (existingRequest) {
    return { success: false, error: "Invite already sent" };
  }

  await db.insert(tabInviteRequest).values({
    tabId,
    fromUserId: session.user.id,
    toUserId: targetUser.id,
    status: "pending",
  });

  return { success: true };
}

export async function getPendingTabInviteRequests() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { success: false, error: "Unauthorized", requests: [] };
  }

  const rows = await db
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
        eq(tabInviteRequest.toUserId, session.user.id),
        eq(tabInviteRequest.status, "pending")
      )
    )
    .orderBy(desc(tabInviteRequest.createdAt));

  return {
    success: true,
    requests: rows.map((r) => ({
      id: r.id,
      tabId: r.tabId,
      fromUserId: r.fromUserId,
      tabName: r.tabName,
      fromUserName: r.fromUserName,
      fromUserUsername: r.fromUserUsername,
      createdAt: r.createdAt,
    })),
  };
}

export async function acceptTabInviteRequest(requestId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { success: false, error: "Unauthorized", tabId: null };
  }

  const [req] = await db
    .select()
    .from(tabInviteRequest)
    .where(
      and(
        eq(tabInviteRequest.id, requestId),
        eq(tabInviteRequest.toUserId, session.user.id),
        eq(tabInviteRequest.status, "pending")
      )
    )
    .limit(1);

  if (!req) {
    return { success: false, error: "Request not found or already handled", tabId: null };
  }

  const [existing] = await db
    .select()
    .from(tabMember)
    .where(
      and(
        eq(tabMember.tabId, req.tabId),
        eq(tabMember.userId, session.user.id)
      )
    )
    .limit(1);

  if (existing) {
    await db
      .update(tabInviteRequest)
      .set({ status: "accepted" })
      .where(eq(tabInviteRequest.id, requestId));
    return { success: true, tabId: req.tabId, alreadyMember: true };
  }

  await addUserToTabAndCreateFriendships(session.user.id, req.tabId);
  await db
    .update(tabInviteRequest)
    .set({ status: "accepted" })
    .where(eq(tabInviteRequest.id, requestId));

  return { success: true, tabId: req.tabId };
}

export async function rejectTabInviteRequest(requestId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  const [req] = await db
    .select()
    .from(tabInviteRequest)
    .where(
      and(
        eq(tabInviteRequest.id, requestId),
        eq(tabInviteRequest.toUserId, session.user.id),
        eq(tabInviteRequest.status, "pending")
      )
    )
    .limit(1);

  if (!req) {
    return { success: false, error: "Request not found or already handled" };
  }

  await db
    .update(tabInviteRequest)
    .set({ status: "rejected" })
    .where(eq(tabInviteRequest.id, requestId));

  return { success: true };
}
