import { z } from "zod";
import { friend, tabInvite } from "data";
import { authed } from "../auth-middleware.js";
import { ORPCError } from "@orpc/server";

export const notificationsProcedures = {
  listMissed: authed
    .input(z.object({ since: z.number().nonnegative() }))
    .handler(async ({ context, input }) => {
      if (!Number.isFinite(input.since) || input.since < 0) {
        throw new ORPCError("BAD_REQUEST", { message: "Invalid since parameter" });
      }
      const sinceDate = new Date(input.since);
      const [friendRequests, tabInvites] = await Promise.all([
        friend.getMissedFriendRequests(context.userId!, sinceDate),
        tabInvite.getMissedTabInvites(context.userId!, sinceDate),
      ]);
      return {
        friendRequests: friendRequests.map((r) => ({
          id: r.id,
          type: "friend_request" as const,
          requestId: r.id,
          fromUserId: r.fromUserId,
          fromUserUsername: r.fromUserUsername,
          fromUserName: r.fromUserName,
          createdAt: r.createdAt,
        })),
        tabInvites: tabInvites.map((r) => ({
          id: r.id,
          type: "tab_invite" as const,
          requestId: r.id,
          tabId: r.tabId,
          tabName: r.tabName,
          fromUserId: r.fromUserId,
          fromUserUsername: r.fromUserUsername,
          fromUserName: r.fromUserName,
          createdAt: r.createdAt,
        })),
      };
    }),
};
