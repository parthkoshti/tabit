import { Hono } from "hono";
import {
  db,
  tab,
  tabMember,
  user,
  tabInviteRequest,
  pendingTabInvite,
} from "db";
import { eq, and, desc, sql } from "drizzle-orm";
import { createId } from "shared";
import { authMiddleware, type AuthContext } from "../auth.js";
import { publishNotification } from "../lib/redis.js";
import {
  createTabInviteNotificationPayload,
  createTabInviteAcceptedNotificationPayload,
} from "models";

function secureToken(): string {
  return createId();
}

async function createDirectTab(
  userId1: string,
  userId2: string,
): Promise<string> {
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
  userId2: string,
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
      .where(and(eq(tabMember.tabId, t.id), eq(tabMember.userId, userId2)))
      .limit(1);
    if (other) return t.id;
  }

  return createDirectTab(userId1, userId2);
}

async function publishTabInviteAcceptedNotification(
  accepterUserId: string,
  requestId: string,
  req: { tabId: string; fromUserId: string },
): Promise<void> {
  const [tabRow] = await db
    .select({ name: tab.name })
    .from(tab)
    .where(eq(tab.id, req.tabId))
    .limit(1);

  const [accepter] = await db
    .select({ name: user.name, username: user.username })
    .from(user)
    .where(eq(user.id, accepterUserId))
    .limit(1);

  await publishNotification(
    req.fromUserId,
    createTabInviteAcceptedNotificationPayload({
      requestId,
      tabId: req.tabId,
      tabName: tabRow?.name ?? "Tab",
      fromUserId: accepterUserId,
      fromUserName: accepter?.name ?? null,
      fromUserUsername: accepter?.username ?? null,
      createdAt: new Date(),
    }),
  );
}

async function addUserToTabAndCreateFriendships(
  userId: string,
  tabId: string,
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

export const tabInvitesRoutes = new Hono<{
  Variables: { auth: AuthContext };
}>();

tabInvitesRoutes.get("/by-token", async (c) => {
  const token = c.req.query("token");
  if (!token?.trim()) {
    return c.json(
      { success: false, error: "Invalid token", tab: null, creator: null },
      400,
    );
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
        sql`${pendingTabInvite.expiresAt} > NOW()`,
      ),
    )
    .limit(1);

  if (!pending) {
    return c.json(
      {
        success: false,
        error: "Invalid or expired link",
        tab: null,
        creator: null,
      },
      404,
    );
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
    return c.json(
      {
        success: false,
        error: "Tab or creator not found",
        tab: null,
        creator: null,
      },
      404,
    );
  }

  return c.json({
    success: true,
    tab: tabRow,
    creator,
    tabId: pending.tabId,
  });
});

tabInvitesRoutes.use("*", authMiddleware);

tabInvitesRoutes.post("/join-by-token", async (c) => {
  const { userId } = c.get("auth");

  const body = await c.req.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token.trim() : null;

  if (!token) {
    return c.json({ success: false, error: "Invalid token", tabId: null }, 400);
  }

  const [pending] = await db
    .select()
    .from(pendingTabInvite)
    .where(
      and(
        eq(pendingTabInvite.token, token),
        sql`${pendingTabInvite.expiresAt} > NOW()`,
      ),
    )
    .limit(1);

  if (!pending) {
    return c.json(
      { success: false, error: "Invalid or expired link", tabId: null },
      404,
    );
  }

  const [existing] = await db
    .select()
    .from(tabMember)
    .where(
      and(eq(tabMember.tabId, pending.tabId), eq(tabMember.userId, userId)),
    )
    .limit(1);

  if (existing) {
    await db
      .delete(pendingTabInvite)
      .where(eq(pendingTabInvite.id, pending.id));
    return c.json({ success: true, tabId: pending.tabId, alreadyMember: true });
  }

  await addUserToTabAndCreateFriendships(userId, pending.tabId);
  await db.delete(pendingTabInvite).where(eq(pendingTabInvite.id, pending.id));

  return c.json({ success: true, tabId: pending.tabId });
});

tabInvitesRoutes.get("/token", async (c) => {
  const { userId } = c.get("auth");
  const tabId = c.req.query("tabId");

  if (!tabId) {
    return c.json({ success: false, error: "tabId required", url: null }, 400);
  }

  const [member] = await db
    .select()
    .from(tabMember)
    .where(and(eq(tabMember.tabId, tabId), eq(tabMember.userId, userId)))
    .limit(1);

  if (!member) {
    return c.json(
      { success: false, error: "Not a member of this tab", url: null },
      403,
    );
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const [existing] = await db
    .select()
    .from(pendingTabInvite)
    .where(
      and(
        eq(pendingTabInvite.tabId, tabId),
        eq(pendingTabInvite.createdByUserId, userId),
        sql`${pendingTabInvite.expiresAt} > NOW()`,
      ),
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
          eq(pendingTabInvite.createdByUserId, userId),
        ),
      );
    token = secureToken();
    for (let i = 0; i < 5; i++) {
      try {
        await db.insert(pendingTabInvite).values({
          token,
          tabId,
          createdByUserId: userId,
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
  const url = `${baseUrl}/invite?type=tab&token=${encodeURIComponent(token)}`;

  return c.json({ success: true, url });
});

tabInvitesRoutes.get("/requests/pending", async (c) => {
  const { userId } = c.get("auth");

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
        eq(tabInviteRequest.toUserId, userId),
        eq(tabInviteRequest.status, "pending"),
      ),
    )
    .orderBy(desc(tabInviteRequest.createdAt));

  return c.json({
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
  });
});

tabInvitesRoutes.post("/requests", async (c) => {
  const { userId } = c.get("auth");

  const body = await c.req.json().catch(() => ({}));
  const tabId = body.tabId;
  const username = body.username;

  if (typeof tabId !== "string" || !tabId) {
    return c.json({ success: false, error: "Tab ID is required" }, 400);
  }
  if (typeof username !== "string" || !username.trim()) {
    return c.json({ success: false, error: "Username is required" }, 400);
  }

  const [member] = await db
    .select()
    .from(tabMember)
    .where(and(eq(tabMember.tabId, tabId), eq(tabMember.userId, userId)))
    .limit(1);

  if (!member) {
    return c.json({ success: false, error: "Not a member of this tab" }, 403);
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
    return c.json({ success: false, error: "You cannot invite yourself" }, 400);
  }

  const [existingMember] = await db
    .select()
    .from(tabMember)
    .where(and(eq(tabMember.tabId, tabId), eq(tabMember.userId, targetUser.id)))
    .limit(1);

  if (existingMember) {
    return c.json({ success: false, error: "User is already a member" }, 400);
  }

  const [existingRequest] = await db
    .select()
    .from(tabInviteRequest)
    .where(
      and(
        eq(tabInviteRequest.tabId, tabId),
        eq(tabInviteRequest.toUserId, targetUser.id),
        eq(tabInviteRequest.status, "pending"),
      ),
    )
    .limit(1);

  if (existingRequest) {
    return c.json({ success: false, error: "Invite already sent" }, 400);
  }

  const [tabRow] = await db
    .select({ name: tab.name })
    .from(tab)
    .where(eq(tab.id, tabId))
    .limit(1);

  const [fromUser] = await db
    .select({ name: user.name, username: user.username })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  const [inserted] = await db
    .insert(tabInviteRequest)
    .values({
      tabId,
      fromUserId: userId,
      toUserId: targetUser.id,
      status: "pending",
    })
    .returning({
      id: tabInviteRequest.id,
      createdAt: tabInviteRequest.createdAt,
    });

  await publishNotification(
    targetUser.id,
    createTabInviteNotificationPayload({
      requestId: inserted!.id,
      tabId,
      tabName: tabRow?.name ?? "Tab",
      fromUserId: userId,
      fromUserName: fromUser?.name ?? null,
      fromUserUsername: fromUser?.username ?? null,
      createdAt: inserted!.createdAt,
    }),
  );

  return c.json({ success: true });
});

tabInvitesRoutes.post("/requests/:id/accept", async (c) => {
  const { userId } = c.get("auth");
  const requestId = c.req.param("id");

  const [req] = await db
    .select()
    .from(tabInviteRequest)
    .where(
      and(
        eq(tabInviteRequest.id, requestId),
        eq(tabInviteRequest.toUserId, userId),
        eq(tabInviteRequest.status, "pending"),
      ),
    )
    .limit(1);

  if (!req) {
    return c.json(
      {
        success: false,
        error: "Request not found or already handled",
        tabId: null,
      },
      404,
    );
  }

  const [existing] = await db
    .select()
    .from(tabMember)
    .where(and(eq(tabMember.tabId, req.tabId), eq(tabMember.userId, userId)))
    .limit(1);

  if (existing) {
    await db
      .update(tabInviteRequest)
      .set({ status: "accepted" })
      .where(eq(tabInviteRequest.id, requestId));
    await publishTabInviteAcceptedNotification(userId, requestId, req);
    return c.json({ success: true, tabId: req.tabId, alreadyMember: true });
  }

  await addUserToTabAndCreateFriendships(userId, req.tabId);
  await db
    .update(tabInviteRequest)
    .set({ status: "accepted" })
    .where(eq(tabInviteRequest.id, requestId));

  await publishTabInviteAcceptedNotification(userId, requestId, req);
  return c.json({ success: true, tabId: req.tabId });
});

tabInvitesRoutes.post("/requests/:id/reject", async (c) => {
  const { userId } = c.get("auth");
  const requestId = c.req.param("id");

  const [req] = await db
    .select()
    .from(tabInviteRequest)
    .where(
      and(
        eq(tabInviteRequest.id, requestId),
        eq(tabInviteRequest.toUserId, userId),
        eq(tabInviteRequest.status, "pending"),
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
    .update(tabInviteRequest)
    .set({ status: "rejected" })
    .where(eq(tabInviteRequest.id, requestId));

  return c.json({ success: true });
});
