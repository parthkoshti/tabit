import { z } from "zod";

export const notificationTypeSchema = z.enum([
  "friend_request",
  "tab_invite",
  "friend_request_accepted",
  "tab_invite_accepted",
  "expense_added",
  "expense_updated",
  "expense_deleted",
  "expense_restored",
  "expenses_bulk_imported",
  "poke",
  "expense_reaction",
  "recurring_rule_needs_fix",
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
  isDirect: z.boolean().optional(),
  fromUserId: z.string(),
  fromUserName: z.string().nullable(),
  description: z.string(),
  amount: z.string(),
  recipientOweAmount: z.string().optional(),
  currencySymbol: z.string().optional(),
  createdAt: z.string(),
  /** When set, expense was created by a recurring rule (copy for push/UI). */
  recurringRuleId: z.string().optional(),
  recurringRuleTitle: z.string().optional(),
  ruleOwnerName: z.string().nullable().optional(),
  /** Path only, e.g. /expense/recurring/abc — client may prefix origin. */
  editRulePath: z.string().optional(),
});

export const recurringRuleNeedsFixNotificationPayloadSchema = z.object({
  type: z.literal("recurring_rule_needs_fix"),
  ruleId: z.string(),
  tabId: z.string(),
  tabName: z.string(),
  reason: z.enum(["validation_failed", "not_tab_member", "unknown"]),
  editRulePath: z.string(),
  createdAt: z.string(),
});
export type RecurringRuleNeedsFixNotificationPayload = z.infer<
  typeof recurringRuleNeedsFixNotificationPayloadSchema
>;
export type ExpenseAddedNotificationPayload = z.infer<
  typeof expenseAddedNotificationPayloadSchema
>;

export const expenseUpdatedNotificationPayloadSchema = z.object({
  type: z.literal("expense_updated"),
  tabId: z.string(),
  expenseId: z.string(),
  tabName: z.string(),
  isDirect: z.boolean().optional(),
  fromUserId: z.string(),
  fromUserName: z.string().nullable(),
  description: z.string(),
  amount: z.string(),
  recipientOweAmount: z.string().optional(),
  currencySymbol: z.string().optional(),
  descriptionChanged: z.boolean().optional(),
  amountChanged: z.boolean().optional(),
  previousDescription: z.string().optional(),
  createdAt: z.string(),
});
export type ExpenseUpdatedNotificationPayload = z.infer<
  typeof expenseUpdatedNotificationPayloadSchema
>;

export const expenseDeletedNotificationPayloadSchema = z.object({
  type: z.literal("expense_deleted"),
  tabId: z.string(),
  expenseId: z.string(),
  tabName: z.string(),
  isDirect: z.boolean().optional(),
  fromUserId: z.string(),
  fromUserName: z.string().nullable(),
  description: z.string(),
  amount: z.string(),
  currencySymbol: z.string().optional(),
  deletedAt: z.string(),
  createdAt: z.string(),
});
export type ExpenseDeletedNotificationPayload = z.infer<
  typeof expenseDeletedNotificationPayloadSchema
>;

export const expenseRestoredNotificationPayloadSchema = z.object({
  type: z.literal("expense_restored"),
  tabId: z.string(),
  expenseId: z.string(),
  tabName: z.string(),
  isDirect: z.boolean().optional(),
  fromUserId: z.string(),
  fromUserName: z.string().nullable(),
  description: z.string(),
  amount: z.string(),
  currencySymbol: z.string().optional(),
  createdAt: z.string(),
});
export type ExpenseRestoredNotificationPayload = z.infer<
  typeof expenseRestoredNotificationPayloadSchema
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

export const pokeNotificationPayloadSchema = z.object({
  type: z.literal("poke"),
  friendTabId: z.string(),
  fromUserId: z.string(),
  fromUserName: z.string().nullable(),
  fromUserUsername: z.string().nullable(),
  createdAt: z.string(),
});
export type PokeNotificationPayload = z.infer<
  typeof pokeNotificationPayloadSchema
>;

export const expenseReactionNotificationPayloadSchema = z.object({
  type: z.literal("expense_reaction"),
  tabId: z.string(),
  expenseId: z.string(),
  tabName: z.string(),
  isDirect: z.boolean().optional(),
  fromUserId: z.string(),
  fromUserName: z.string().nullable(),
  description: z.string(),
  amount: z.string(),
  emoji: z.string(),
  createdAt: z.string(),
});
export type ExpenseReactionNotificationPayload = z.infer<
  typeof expenseReactionNotificationPayloadSchema
>;

export const notificationPayloadSchema = z.discriminatedUnion("type", [
  friendRequestNotificationPayloadSchema,
  tabInviteNotificationPayloadSchema,
  friendRequestAcceptedNotificationPayloadSchema,
  tabInviteAcceptedNotificationPayloadSchema,
  expenseAddedNotificationPayloadSchema,
  expenseUpdatedNotificationPayloadSchema,
  expenseDeletedNotificationPayloadSchema,
  expenseRestoredNotificationPayloadSchema,
  expensesBulkImportedNotificationPayloadSchema,
  pokeNotificationPayloadSchema,
  expenseReactionNotificationPayloadSchema,
  recurringRuleNeedsFixNotificationPayloadSchema,
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
  isDirect?: boolean;
  fromUserId: string;
  fromUserName: string | null;
  description: string;
  amount: string;
  recipientOweAmount?: string;
  currencySymbol?: string;
  createdAt: Date;
  recurringRuleId?: string;
  recurringRuleTitle?: string;
  ruleOwnerName?: string | null;
  editRulePath?: string;
}): ExpenseAddedNotificationPayload {
  return {
    type: "expense_added",
    tabId: data.tabId,
    expenseId: data.expenseId,
    tabName: data.tabName,
    isDirect: data.isDirect,
    fromUserId: data.fromUserId,
    fromUserName: data.fromUserName,
    description: data.description,
    amount: data.amount,
    recipientOweAmount: data.recipientOweAmount,
    currencySymbol: data.currencySymbol,
    createdAt: data.createdAt.toISOString(),
    recurringRuleId: data.recurringRuleId,
    recurringRuleTitle: data.recurringRuleTitle,
    ruleOwnerName: data.ruleOwnerName,
    editRulePath: data.editRulePath,
  };
}

export function createRecurringRuleNeedsFixNotificationPayload(data: {
  ruleId: string;
  tabId: string;
  tabName: string;
  reason: RecurringRuleNeedsFixNotificationPayload["reason"];
  editRulePath: string;
  createdAt: Date;
}): RecurringRuleNeedsFixNotificationPayload {
  return {
    type: "recurring_rule_needs_fix",
    ruleId: data.ruleId,
    tabId: data.tabId,
    tabName: data.tabName,
    reason: data.reason,
    editRulePath: data.editRulePath,
    createdAt: data.createdAt.toISOString(),
  };
}

export function createExpenseUpdatedNotificationPayload(data: {
  tabId: string;
  expenseId: string;
  tabName: string;
  isDirect?: boolean;
  fromUserId: string;
  fromUserName: string | null;
  description: string;
  amount: string;
  recipientOweAmount?: string;
  currencySymbol?: string;
  descriptionChanged?: boolean;
  amountChanged?: boolean;
  previousDescription?: string;
  createdAt: Date;
}): ExpenseUpdatedNotificationPayload {
  return {
    type: "expense_updated",
    tabId: data.tabId,
    expenseId: data.expenseId,
    tabName: data.tabName,
    isDirect: data.isDirect,
    fromUserId: data.fromUserId,
    fromUserName: data.fromUserName,
    description: data.description,
    amount: data.amount,
    recipientOweAmount: data.recipientOweAmount,
    currencySymbol: data.currencySymbol,
    descriptionChanged: data.descriptionChanged,
    amountChanged: data.amountChanged,
    previousDescription: data.previousDescription,
    createdAt: data.createdAt.toISOString(),
  };
}

export function createExpenseDeletedNotificationPayload(data: {
  tabId: string;
  expenseId: string;
  tabName: string;
  isDirect?: boolean;
  fromUserId: string;
  fromUserName: string | null;
  description: string;
  amount: string;
  currencySymbol?: string;
  deletedAt: Date;
  createdAt: Date;
}): ExpenseDeletedNotificationPayload {
  return {
    type: "expense_deleted",
    tabId: data.tabId,
    expenseId: data.expenseId,
    tabName: data.tabName,
    isDirect: data.isDirect,
    fromUserId: data.fromUserId,
    fromUserName: data.fromUserName,
    description: data.description,
    amount: data.amount,
    currencySymbol: data.currencySymbol,
    deletedAt: data.deletedAt.toISOString(),
    createdAt: data.createdAt.toISOString(),
  };
}

export function createExpenseRestoredNotificationPayload(data: {
  tabId: string;
  expenseId: string;
  tabName: string;
  isDirect?: boolean;
  fromUserId: string;
  fromUserName: string | null;
  description: string;
  amount: string;
  currencySymbol?: string;
  createdAt: Date;
}): ExpenseRestoredNotificationPayload {
  return {
    type: "expense_restored",
    tabId: data.tabId,
    expenseId: data.expenseId,
    tabName: data.tabName,
    isDirect: data.isDirect,
    fromUserId: data.fromUserId,
    fromUserName: data.fromUserName,
    description: data.description,
    amount: data.amount,
    currencySymbol: data.currencySymbol,
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

export function createPokeNotificationPayload(data: {
  friendTabId: string;
  fromUserId: string;
  fromUserName: string | null;
  fromUserUsername: string | null;
  createdAt: Date;
}): PokeNotificationPayload {
  return {
    type: "poke",
    friendTabId: data.friendTabId,
    fromUserId: data.fromUserId,
    fromUserName: data.fromUserName,
    fromUserUsername: data.fromUserUsername,
    createdAt: data.createdAt.toISOString(),
  };
}

export function createExpenseReactionNotificationPayload(data: {
  tabId: string;
  expenseId: string;
  tabName: string;
  isDirect?: boolean;
  fromUserId: string;
  fromUserName: string | null;
  description: string;
  amount: string;
  emoji: string;
  createdAt: Date;
}): ExpenseReactionNotificationPayload {
  return {
    type: "expense_reaction",
    tabId: data.tabId,
    expenseId: data.expenseId,
    tabName: data.tabName,
    isDirect: data.isDirect,
    fromUserId: data.fromUserId,
    fromUserName: data.fromUserName,
    description: data.description,
    amount: data.amount,
    emoji: data.emoji,
    createdAt: data.createdAt.toISOString(),
  };
}
