import { z } from "zod";

export const notificationTypeSchema = z.enum(["friend_request", "tab_invite"]);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

export const friendRequestNotificationPayloadSchema = z.object({
  type: z.literal("friend_request"),
  requestId: z.string(),
  fromUserId: z.string(),
  fromUserName: z.string().nullable(),
  fromUserUsername: z.string().nullable(),
  createdAt: z.string(),
});
export type FriendRequestNotificationPayload = z.infer<
  typeof friendRequestNotificationPayloadSchema
>;

export const tabInviteNotificationPayloadSchema = z.object({
  type: z.literal("tab_invite"),
  requestId: z.string(),
  tabId: z.string(),
  tabName: z.string(),
  fromUserId: z.string(),
  fromUserName: z.string().nullable(),
  fromUserUsername: z.string().nullable(),
  createdAt: z.string(),
});
export type TabInviteNotificationPayload = z.infer<
  typeof tabInviteNotificationPayloadSchema
>;

export const notificationPayloadSchema = z.discriminatedUnion("type", [
  friendRequestNotificationPayloadSchema,
  tabInviteNotificationPayloadSchema,
]);
export type NotificationPayload = z.infer<typeof notificationPayloadSchema>;

export function createFriendRequestNotificationPayload(data: {
  requestId: string;
  fromUserId: string;
  fromUserName: string | null;
  fromUserUsername: string | null;
  createdAt: Date;
}): FriendRequestNotificationPayload {
  return {
    type: "friend_request",
    requestId: data.requestId,
    fromUserId: data.fromUserId,
    fromUserName: data.fromUserName,
    fromUserUsername: data.fromUserUsername,
    createdAt: data.createdAt.toISOString(),
  };
}

export function createTabInviteNotificationPayload(data: {
  requestId: string;
  tabId: string;
  tabName: string;
  fromUserId: string;
  fromUserName: string | null;
  fromUserUsername: string | null;
  createdAt: Date;
}): TabInviteNotificationPayload {
  return {
    type: "tab_invite",
    requestId: data.requestId,
    tabId: data.tabId,
    tabName: data.tabName,
    fromUserId: data.fromUserId,
    fromUserName: data.fromUserName,
    fromUserUsername: data.fromUserUsername,
    createdAt: data.createdAt.toISOString(),
  };
}
