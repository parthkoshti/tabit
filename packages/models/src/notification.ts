import { z } from "zod";

export const notificationTypeSchema = z.enum([
  "friend_request",
  "tab_invite",
  "friend_request_accepted",
  "tab_invite_accepted",
  "expense_added",
  "expense_updated",
  "expenses_bulk_imported",
]);
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

export const friendRequestAcceptedNotificationPayloadSchema = z.object({
  type: z.literal("friend_request_accepted"),
  requestId: z.string(),
  friendTabId: z.string(),
  fromUserId: z.string(),
  fromUserName: z.string().nullable(),
  fromUserUsername: z.string().nullable(),
  createdAt: z.string(),
});
export type FriendRequestAcceptedNotificationPayload = z.infer<
  typeof friendRequestAcceptedNotificationPayloadSchema
>;

export const tabInviteAcceptedNotificationPayloadSchema = z.object({
  type: z.literal("tab_invite_accepted"),
  requestId: z.string(),
  tabId: z.string(),
  tabName: z.string(),
  fromUserId: z.string(),
  fromUserName: z.string().nullable(),
  fromUserUsername: z.string().nullable(),
  createdAt: z.string(),
});
export type TabInviteAcceptedNotificationPayload = z.infer<
  typeof tabInviteAcceptedNotificationPayloadSchema
>;

export const expenseAddedNotificationPayloadSchema = z.object({
  type: z.literal("expense_added"),
  tabId: z.string(),
  expenseId: z.string(),
  tabName: z.string(),
  fromUserId: z.string(),
  fromUserName: z.string().nullable(),
  description: z.string(),
  amount: z.string(),
  createdAt: z.string(),
});
export type ExpenseAddedNotificationPayload = z.infer<
  typeof expenseAddedNotificationPayloadSchema
>;

export const expenseUpdatedNotificationPayloadSchema = z.object({
  type: z.literal("expense_updated"),
  tabId: z.string(),
  expenseId: z.string(),
  tabName: z.string(),
  fromUserId: z.string(),
  fromUserName: z.string().nullable(),
  description: z.string(),
  amount: z.string(),
  createdAt: z.string(),
});
export type ExpenseUpdatedNotificationPayload = z.infer<
  typeof expenseUpdatedNotificationPayloadSchema
>;

export const expensesBulkImportedNotificationPayloadSchema = z.object({
  type: z.literal("expenses_bulk_imported"),
  tabId: z.string(),
  tabName: z.string(),
  fromUserId: z.string(),
  fromUserName: z.string().nullable(),
  count: z.number(),
  createdAt: z.string(),
});
export type ExpensesBulkImportedNotificationPayload = z.infer<
  typeof expensesBulkImportedNotificationPayloadSchema
>;

export const notificationPayloadSchema = z.discriminatedUnion("type", [
  friendRequestNotificationPayloadSchema,
  tabInviteNotificationPayloadSchema,
  friendRequestAcceptedNotificationPayloadSchema,
  tabInviteAcceptedNotificationPayloadSchema,
  expenseAddedNotificationPayloadSchema,
  expenseUpdatedNotificationPayloadSchema,
  expensesBulkImportedNotificationPayloadSchema,
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

export function createFriendRequestAcceptedNotificationPayload(data: {
  requestId: string;
  friendTabId: string;
  fromUserId: string;
  fromUserName: string | null;
  fromUserUsername: string | null;
  createdAt: Date;
}): FriendRequestAcceptedNotificationPayload {
  return {
    type: "friend_request_accepted",
    requestId: data.requestId,
    friendTabId: data.friendTabId,
    fromUserId: data.fromUserId,
    fromUserName: data.fromUserName,
    fromUserUsername: data.fromUserUsername,
    createdAt: data.createdAt.toISOString(),
  };
}

export function createTabInviteAcceptedNotificationPayload(data: {
  requestId: string;
  tabId: string;
  tabName: string;
  fromUserId: string;
  fromUserName: string | null;
  fromUserUsername: string | null;
  createdAt: Date;
}): TabInviteAcceptedNotificationPayload {
  return {
    type: "tab_invite_accepted",
    requestId: data.requestId,
    tabId: data.tabId,
    tabName: data.tabName,
    fromUserId: data.fromUserId,
    fromUserName: data.fromUserName,
    fromUserUsername: data.fromUserUsername,
    createdAt: data.createdAt.toISOString(),
  };
}

export function createExpenseAddedNotificationPayload(data: {
  tabId: string;
  expenseId: string;
  tabName: string;
  fromUserId: string;
  fromUserName: string | null;
  description: string;
  amount: string;
  createdAt: Date;
}): ExpenseAddedNotificationPayload {
  return {
    type: "expense_added",
    tabId: data.tabId,
    expenseId: data.expenseId,
    tabName: data.tabName,
    fromUserId: data.fromUserId,
    fromUserName: data.fromUserName,
    description: data.description,
    amount: data.amount,
    createdAt: data.createdAt.toISOString(),
  };
}

export function createExpenseUpdatedNotificationPayload(data: {
  tabId: string;
  expenseId: string;
  tabName: string;
  fromUserId: string;
  fromUserName: string | null;
  description: string;
  amount: string;
  createdAt: Date;
}): ExpenseUpdatedNotificationPayload {
  return {
    type: "expense_updated",
    tabId: data.tabId,
    expenseId: data.expenseId,
    tabName: data.tabName,
    fromUserId: data.fromUserId,
    fromUserName: data.fromUserName,
    description: data.description,
    amount: data.amount,
    createdAt: data.createdAt.toISOString(),
  };
}

export function createExpensesBulkImportedNotificationPayload(data: {
  tabId: string;
  tabName: string;
  fromUserId: string;
  fromUserName: string | null;
  count: number;
  createdAt: Date;
}): ExpensesBulkImportedNotificationPayload {
  return {
    type: "expenses_bulk_imported",
    tabId: data.tabId,
    tabName: data.tabName,
    fromUserId: data.fromUserId,
    fromUserName: data.fromUserName,
    count: data.count,
    createdAt: data.createdAt.toISOString(),
  };
}
