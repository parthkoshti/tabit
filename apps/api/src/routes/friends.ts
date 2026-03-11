import { Hono } from "hono";
import { db, tab as tabTable, tabMember, user, friendRequest, pendingFriend } from "db";
import { eq, and, ne, desc, ilike, inArray, sql } from "drizzle-orm";
import { createShortId } from "shared";
import { authMiddleware, type AuthContext } from "../auth.js";
import { publishNotification } from "../lib/redis.js";
import {
  createFriendRequestNotificationPayload,
  createFriendRequestAcceptedNotificationPayload,
} from "models";
import { tab } from "data";

function secureToken(): string {
  return createShortId();
}

export const friendsRoutes = new Hono<{ Variables: { auth: AuthContext } }>();

friendsRoutes.use("*", authMiddleware);

friendsRoutes.get("/requests/pending", async (c) => {
  const { userId } = c.get("auth");

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
        eq(friendRequest.toUserId, userId),
        eq(friendRequest.status, "pending"),
      ),
    )
    .orderBy(desc(friendRequest.createdAt));

  return c.json({
    success: true,
    requests: requests.map((r) => ({
      id: r.id,
      fromUserId: r.fromUserId,
      fromUserUsername: r.fromUserUsername,
      fromUserName: r.fromUserName,
      createdAt: r.createdAt,
    })),
  });
});

friendsRoutes.post("/requests", async (c) => {
  const { userId } = c.get("auth");

  const body = await c.req.json().catch(() => ({}));
  const username = body.username;

  if (typeof username !== "string" || !username.trim()) {
    return c.json({ success: false, error: "Username is required" }, 400);
  }

  const [targetUser] = await db
    .select()
    .from(user)
    .where(eq(user.username, username.trim().toLowerCase()))
    .limit(1);

  if (!targetUser) {
    return c.json({ success: false, error: "User not found" }, 404);
  }

  if (targetUser.id === userId) {
    return c.json({ success: false, error: "You cannot add yourself" }, 400);
  }

  const directTabs = await db
    .select({ id: tabTable.id })
    .from(tabTable)
    .innerJoin(tabMember, eq(tabTable.id, tabMember.tabId))
    .where(and(eq(tabTable.isDirect, true), eq(tabMember.userId, userId)));

  for (const t of directTabs) {
    const [otherMember] = await db
      .select()
      .from(tabMember)
      .where(
        and(eq(tabMember.tabId, t.id), eq(tabMember.userId, targetUser.id)),
      )
      .limit(1);
    if (otherMember) {
      return c.json(
        { success: false, error: "You are already friends with this person" },
        400,
      );
    }
  }

  const [existingRequest] = await db
    .select()
    .from(friendRequest)
    .where(
      and(
        eq(friendRequest.fromUserId, userId),
        eq(friendRequest.toUserId, targetUser.id),
        eq(friendRequest.status, "pending"),
      ),
    )
    .limit(1);

  if (existingRequest) {
    return c.json(
      { success: false, error: "Friend request already sent" },
      400,
    );
  }

  const [inserted] = await db
    .insert(friendRequest)
    .values({
      fromUserId: userId,
      toUserId: targetUser.id,
      status: "pending",
    })
    .returning({
      id: friendRequest.id,
      createdAt: friendRequest.createdAt,
    });

  const [sender] = await db
    .select({ name: user.name, username: user.username })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  await publishNotification(
    targetUser.id,
    createFriendRequestNotificationPayload({
      requestId: inserted!.id,
      fromUserId: userId,
      fromUserName: sender?.name ?? null,
      fromUserUsername: sender?.username ?? null,
      createdAt: inserted!.createdAt,
    }),
  );

  return c.json({ success: true });
});

friendsRoutes.post("/requests/:id/accept", async (c) => {
  const { userId } = c.get("auth");
  const requestId = c.req.param("id");

  const [req] = await db
    .select()
    .from(friendRequest)
    .where(
      and(
        eq(friendRequest.id, requestId),
        eq(friendRequest.toUserId, userId),
        eq(friendRequest.status, "pending"),
      ),
    )
    .limit(1);

  if (!req) {
    return c.json(
      { success: false, error: "Request not found or already handled" },
      404,
    );
  }

  await db
    .update(friendRequest)
    .set({ status: "accepted" })
    .where(eq(friendRequest.id, requestId));

  const friendTabId = await tab.createDirect(userId, req.fromUserId);

  const [accepter] = await db
    .select({ name: user.name, username: user.username })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  await publishNotification(
    req.fromUserId,
    createFriendRequestAcceptedNotificationPayload({
      requestId,
      friendTabId,
      fromUserId: userId,
      fromUserName: accepter?.name ?? null,
      fromUserUsername: accepter?.username ?? null,
      createdAt: new Date(),
    }),
  );

  return c.json({ success: true, friendTabId });
});

friendsRoutes.post("/requests/:id/reject", async (c) => {
  const { userId } = c.get("auth");
  const requestId = c.req.param("id");

  await db
    .update(friendRequest)
    .set({ status: "rejected" })
    .where(
      and(eq(friendRequest.id, requestId), eq(friendRequest.toUserId, userId)),
    );

  return c.json({ success: true });
});

friendsRoutes.get("/token", async (c) => {
  const { userId } = c.get("auth");

  const [sessionUser] = await db
    .select({ username: user.username })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  const username = sessionUser?.username;
  if (!username) {
    return c.json(
      { success: false, error: "Set a username first", token: null, url: null },
      400,
    );
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const [existing] = await db
    .select()
    .from(pendingFriend)
    .where(
      and(
        eq(pendingFriend.userId, userId),
        sql`${pendingFriend.expiresAt} > NOW()`,
      ),
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
          token,
          userId,
          expiresAt,
        });
        break;
      } catch {
        token = secureToken();
        if (i === 4) throw new Error("Failed to generate invite token");
      }
    }
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_PWA_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "http://localhost:3003";
  const url = `${baseUrl}/invite?user=${encodeURIComponent(username)}&qr=${encodeURIComponent(token)}`;

  return c.json({ success: true, token, url });
});

friendsRoutes.post("/add-by-token", async (c) => {
  const { userId } = c.get("auth");

  const body = await c.req.json().catch(() => ({}));
  const token = body.token;

  if (!token?.trim()) {
    return c.json({ success: false, error: "Invalid token" }, 400);
  }

  const [pending] = await db
    .select()
    .from(pendingFriend)
    .where(
      and(
        eq(pendingFriend.token, token.trim()),
        sql`${pendingFriend.expiresAt} > NOW()`,
      ),
    )
    .limit(1);

  if (!pending) {
    return c.json({ success: false, error: "Invalid or expired link" }, 400);
  }

  if (pending.userId === userId) {
    return c.json({ success: false, error: "You cannot add yourself" }, 400);
  }

  const directTabs = await db
    .select({ id: tabTable.id })
    .from(tabTable)
    .innerJoin(tabMember, eq(tabTable.id, tabMember.tabId))
    .where(and(eq(tabTable.isDirect, true), eq(tabMember.userId, userId)));

  for (const t of directTabs) {
    const [otherMember] = await db
      .select()
      .from(tabMember)
      .where(
        and(eq(tabMember.tabId, t.id), eq(tabMember.userId, pending.userId)),
      )
      .limit(1);
    if (otherMember) {
      await db.delete(pendingFriend).where(eq(pendingFriend.id, pending.id));
      return c.json({ success: true, friendTabId: t.id, alreadyFriends: true });
    }
  }

  const friendTabId = await tab.createDirect(userId, pending.userId);
  await db.delete(pendingFriend).where(eq(pendingFriend.id, pending.id));

  return c.json({ success: true, friendTabId });
});

friendsRoutes.get("/search", async (c) => {
  const { userId } = c.get("auth");
  const query = c.req.query("q") ?? "";
  const includeFriends = c.req.query("includeFriends") === "true";

  const trimmed = query.trim().toLowerCase();
  if (trimmed.length < 3) {
    return c.json({ success: true, users: [] });
  }

  const friendIdSet = new Set<string>();
  if (!includeFriends) {
    const directTabIds = await db
      .select({ tabId: tabMember.tabId })
      .from(tabTable)
      .innerJoin(tabMember, eq(tabTable.id, tabMember.tabId))
      .where(and(eq(tabTable.isDirect, true), eq(tabMember.userId, userId)));

    if (directTabIds.length > 0) {
      const tabIds = directTabIds.map((d) => d.tabId);
      const otherMembers = await db
        .select({ userId: tabMember.userId })
        .from(tabMember)
        .where(
          and(inArray(tabMember.tabId, tabIds), ne(tabMember.userId, userId)),
        );
      otherMembers.forEach((m) => friendIdSet.add(m.userId));
    }
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

  return c.json({
    success: true,
    users: users.filter((u) => u.id !== userId && !friendIdSet.has(u.id)),
  });
});

friendsRoutes.get("/", async (c) => {
  const { userId } = c.get("auth");
  const friends = await tab.getDirectTabsForUser(userId);
  return c.json({ success: true, friends });
});
