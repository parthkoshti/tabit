"use server";

import {
  db,
  tab,
  tabMember,
  user,
  friendRequest,
  pendingFriend,
} from "db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, and, sql, desc, ilike } from "drizzle-orm";
import { nanoid } from "nanoid";

function secureToken(): string {
  return nanoid(5);
}

async function createDirectTab(userId1: string, userId2: string) {
  const id = nanoid();
  await db.insert(tab).values({
    id,
    name: "Direct",
    isDirect: true,
  });
  await db.insert(tabMember).values([
    { tabId: id, userId: userId1, role: "member" },
    { tabId: id, userId: userId2, role: "member" },
  ]);
  return id;
}

export async function searchUsersByUsername(query: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { success: false, error: "Unauthorized", users: [] };
  }

  const trimmed = query.trim().toLowerCase();
  if (trimmed.length < 3) {
    return { success: true, users: [] };
  }

  const users = await db
    .select({
      id: user.id,
      username: user.username,
      name: user.name,
    })
    .from(user)
    .where(ilike(user.username, `%${trimmed}%`))
    .limit(10);

  return {
    success: true,
    users: users.filter((u) => u.id !== session.user.id),
  };
}

export async function sendFriendRequest(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  const username = formData.get("username");
  if (typeof username !== "string" || !username.trim()) {
    return { success: false, error: "Username is required" };
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
    return { success: false, error: "You cannot add yourself" };
  }

  const directTabs = await db
    .select({ id: tab.id })
    .from(tab)
    .innerJoin(tabMember, eq(tab.id, tabMember.tabId))
    .where(and(eq(tab.isDirect, true), eq(tabMember.userId, session.user.id)));

  for (const t of directTabs) {
    const [otherMember] = await db
      .select()
      .from(tabMember)
      .where(
        and(
          eq(tabMember.tabId, t.id),
          eq(tabMember.userId, targetUser.id)
        )
      )
      .limit(1);
    if (otherMember) {
      return { success: false, error: "You are already friends with this person" };
    }
  }

  const [existingRequest] = await db
    .select()
    .from(friendRequest)
    .where(
      and(
        eq(friendRequest.fromUserId, session.user.id),
        eq(friendRequest.toUserId, targetUser.id),
        eq(friendRequest.status, "pending")
      )
    )
    .limit(1);

  if (existingRequest) {
    return { success: false, error: "Friend request already sent" };
  }

  await db.insert(friendRequest).values({
    id: nanoid(),
    fromUserId: session.user.id,
    toUserId: targetUser.id,
    status: "pending",
  });

  return { success: true };
}

export async function getPendingFriendRequests() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { success: false, requests: [] };
  }

  const requests = await db
    .select({
      id: friendRequest.id,
      fromUserId: friendRequest.fromUserId,
      toUserId: friendRequest.toUserId,
      status: friendRequest.status,
      createdAt: friendRequest.createdAt,
      fromUserUsername: user.username,
      fromUserName: user.name,
    })
    .from(friendRequest)
    .innerJoin(user, eq(friendRequest.fromUserId, user.id))
    .where(
      and(
        eq(friendRequest.toUserId, session.user.id),
        eq(friendRequest.status, "pending")
      )
    )
    .orderBy(desc(friendRequest.createdAt));

  return {
    success: true,
    requests: requests.map((r) => ({
      id: r.id,
      fromUserId: r.fromUserId,
      fromUserUsername: r.fromUserUsername,
      fromUserName: r.fromUserName,
      createdAt: r.createdAt,
    })),
  };
}

export async function acceptFriendRequest(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  const requestId = formData.get("requestId");
  if (typeof requestId !== "string" || !requestId) {
    return { success: false, error: "Invalid request" };
  }

  const [req] = await db
    .select()
    .from(friendRequest)
    .where(
      and(
        eq(friendRequest.id, requestId),
        eq(friendRequest.toUserId, session.user.id),
        eq(friendRequest.status, "pending")
      )
    )
    .limit(1);

  if (!req) {
    return { success: false, error: "Request not found or already handled" };
  }

  await db
    .update(friendRequest)
    .set({ status: "accepted" })
    .where(eq(friendRequest.id, requestId));

  const friendTabId = await createDirectTab(session.user.id, req.fromUserId);

  return { success: true, friendTabId };
}

export async function rejectFriendRequest(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  const requestId = formData.get("requestId");
  if (typeof requestId !== "string" || !requestId) {
    return { success: false, error: "Invalid request" };
  }

  await db
    .update(friendRequest)
    .set({ status: "rejected" })
    .where(
      and(
        eq(friendRequest.id, requestId),
        eq(friendRequest.toUserId, session.user.id)
      )
    );

  return { success: true };
}

export async function getFriendToken() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { success: false, error: "Unauthorized", token: null, url: null };
  }

  const username = (session.user as { username?: string })?.username;
  if (!username) {
    return { success: false, error: "Set a username first", token: null, url: null };
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const [existing] = await db
    .select()
    .from(pendingFriend)
    .where(
      and(
        eq(pendingFriend.userId, session.user.id),
        sql`${pendingFriend.expiresAt} > NOW()`
      )
    )
    .limit(1);

  let token: string;
  if (existing && existing.token.length <= 8) {
    token = existing.token;
  } else {
    if (existing) {
      await db.delete(pendingFriend).where(eq(pendingFriend.id, existing.id));
    }
    token = secureToken();
    for (let i = 0; i < 5; i++) {
      try {
        await db.insert(pendingFriend).values({
          id: nanoid(),
          token,
          userId: session.user.id,
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
  const url = `${baseUrl}/invite?user=${encodeURIComponent(username)}&qr=${encodeURIComponent(token)}`;

  return { success: true, token, url };
}

export async function addFriendByToken(token: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { success: false, error: "Unauthorized", redirectToLogin: true };
  }

  if (!token?.trim()) {
    return { success: false, error: "Invalid token" };
  }

  const [pending] = await db
    .select()
    .from(pendingFriend)
    .where(
      and(
        eq(pendingFriend.token, token.trim()),
        sql`${pendingFriend.expiresAt} > NOW()`
      )
    )
    .limit(1);

  if (!pending) {
    return { success: false, error: "Invalid or expired link" };
  }

  if (pending.userId === session.user.id) {
    return { success: false, error: "You cannot add yourself" };
  }

  const directTabs = await db
    .select({ id: tab.id })
    .from(tab)
    .innerJoin(tabMember, eq(tab.id, tabMember.tabId))
    .where(and(eq(tab.isDirect, true), eq(tabMember.userId, session.user.id)));

  for (const t of directTabs) {
    const [otherMember] = await db
      .select()
      .from(tabMember)
      .where(
        and(
          eq(tabMember.tabId, t.id),
          eq(tabMember.userId, pending.userId)
        )
      )
      .limit(1);
    if (otherMember) {
      await db.delete(pendingFriend).where(eq(pendingFriend.id, pending.id));
      return { success: true, friendTabId: t.id, alreadyFriends: true };
    }
  }

  const friendTabId = await createDirectTab(session.user.id, pending.userId);
  await db.delete(pendingFriend).where(eq(pendingFriend.id, pending.id));

  return { success: true, friendTabId };
}
