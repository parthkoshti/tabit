import webpush from "web-push";
import { db, pushSubscription } from "db";
import { eq, and } from "drizzle-orm";
import { log as otelLog } from "otel";
import { getPaymentReminderPushCopy } from "models";
import type { NotificationPayload } from "models";

const LOG_PREFIX = "[workers]";

function log(
  level: "info" | "warn" | "error",
  msg: string,
  data?: Record<string, unknown>,
) {
  otelLog(level, `${LOG_PREFIX} ${msg}`, data);
}

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    "mailto:support@tabit.in",
    vapidPublicKey,
    vapidPrivateKey,
  );
  log("info", "VAPID keys configured, push notifications enabled");
} else {
  log("warn", "VAPID keys not configured, push notifications disabled");
}

const appBaseUrl =
  process.env.NEXT_PUBLIC_PWA_URL ??
  process.env.NEXT_PUBLIC_WEB_URL ??
  process.env.APP_URL ??
  "https://localhost:3003";

function getPushTitle(payload: {
  type: string;
  fromUserName?: string | null;
  tabName?: string;
  description?: string;
  amount?: string;
  amountDisplay?: string;
  tone?: string;
  count?: number;
  forcePush?: boolean;
  isDirect?: boolean;
  emoji?: string;
  currencySymbol?: string;
  recurringRuleId?: string;
  recurringRuleTitle?: string;
  ruleOwnerName?: string | null;
  editRulePath?: string;
  placeholderDisplayName?: string;
  targetDisplayName?: string;
}): string {
  if (payload.forcePush)
    return payload.type === "tab_invite"
      ? "Test tab invite"
      : "Test push notification";
  if (payload.type === "friend_request" && payload.fromUserName) {
    return `Friend request from ${payload.fromUserName}`;
  }
  if (
    payload.type === "tab_invite" &&
    payload.fromUserName &&
    payload.tabName
  ) {
    return `${payload.fromUserName} invited you to ${payload.tabName}`;
  }
  if (payload.type === "friend_request_accepted" && payload.fromUserName) {
    return `${payload.fromUserName} accepted your friend request`;
  }
  if (
    payload.type === "tab_invite_accepted" &&
    payload.fromUserName &&
    payload.tabName
  ) {
    return `${payload.fromUserName} joined ${payload.tabName}`;
  }
  if (
    payload.type === "expense_added" &&
    payload.recurringRuleId &&
    payload.ruleOwnerName
  ) {
    const desc = payload.description || "an expense";
    const rule = payload.recurringRuleTitle || "a recurring rule";
    return `Tab created ${desc} based on ${rule} by ${payload.ruleOwnerName}`;
  }
  if (payload.type === "expense_added" && payload.fromUserName) {
    const desc = payload.description || "expense";
    const sym = payload.currencySymbol ?? "$";
    const amt = payload.amount
      ? ` ${payload.amount.includes(" (") ? payload.amount : `${sym}${payload.amount}`}`
      : "";
    if (payload.isDirect) {
      return `${payload.fromUserName} paid${amt} for ${desc}`;
    }
    return payload.tabName
      ? `${payload.fromUserName} paid${amt} for ${desc} in ${payload.tabName}`
      : `${payload.fromUserName} paid${amt} for ${desc}`;
  }
  if (payload.type === "recurring_rule_needs_fix" && payload.tabName) {
    return `Recurring rule needs attention: ${payload.tabName}`;
  }
  if (payload.type === "expense_updated" && payload.fromUserName) {
    const desc = payload.description || "expense";
    if (payload.isDirect) {
      return `${payload.fromUserName} edited ${desc} expense`;
    }
    return payload.tabName
      ? `${payload.fromUserName} edited ${desc} expense in ${payload.tabName}`
      : `${payload.fromUserName} edited ${desc} expense`;
  }
  if (payload.type === "expense_deleted" && payload.fromUserName) {
    const desc = payload.description || "expense";
    const sym = payload.currencySymbol ?? "$";
    const amt = payload.amount
      ? ` ${payload.amount.includes(" (") ? payload.amount : `${sym}${payload.amount}`} for `
      : " ";
    if (payload.isDirect) {
      return `${payload.fromUserName} deleted ${desc} expense`;
    }
    return payload.tabName
      ? `${payload.fromUserName} deleted${amt}${desc} in ${payload.tabName}`
      : `${payload.fromUserName} deleted ${desc} expense`;
  }
  if (payload.type === "expense_restored" && payload.fromUserName) {
    const desc = payload.description || "expense";
    const sym = payload.currencySymbol ?? "$";
    const amt = payload.amount
      ? ` ${payload.amount.includes(" (") ? payload.amount : `${sym}${payload.amount}`}`
      : "";
    if (payload.isDirect) {
      return `${payload.fromUserName} restored ${desc} expense`;
    }
    return payload.tabName
      ? `${payload.fromUserName} restored${amt} ${desc} in ${payload.tabName}`
      : `${payload.fromUserName} restored ${desc} expense`;
  }
  if (
    payload.type === "expenses_bulk_imported" &&
    payload.tabName &&
    typeof payload.count === "number"
  ) {
    const who = payload.fromUserName ?? "Someone";
    return `${who} imported ${payload.count} expense${payload.count !== 1 ? "s" : ""} to ${payload.tabName}`;
  }
  if (payload.type === "poke" && payload.fromUserName) {
    return `${payload.fromUserName} poked you`;
  }
  if (payload.type === "poke") return "Someone poked you";
  if (payload.type === "payment_reminder") {
    const { title } = getPaymentReminderPushCopy(
      typeof payload.tone === "string" ? payload.tone : "gentle",
      payload.fromUserName ?? null,
      typeof payload.amountDisplay === "string" ? payload.amountDisplay : "",
    );
    return title;
  }
  if (payload.type === "expense_reaction" && payload.fromUserName) {
    const desc = payload.description || "expense";
    if (payload.isDirect) {
      return `${payload.fromUserName} reacted ${payload.emoji} to ${desc}`;
    }
    return payload.tabName
      ? `${payload.fromUserName} reacted ${payload.emoji} to ${desc} in ${payload.tabName}`
      : `${payload.fromUserName} reacted ${payload.emoji} to ${desc}`;
  }
  if (
    payload.type === "placeholder_merged" &&
    payload.tabName &&
    typeof payload.placeholderDisplayName === "string"
  ) {
    const who = payload.fromUserName?.trim() || "Someone";
    return `${who} merged "${payload.placeholderDisplayName}" with you in ${payload.tabName}`;
  }
  if (payload.type === "expense_reaction") return "New reaction on expense";
  if (payload.type === "friend_request") return "New friend request";
  if (payload.type === "tab_invite") return "New tab invite";
  if (payload.type === "friend_request_accepted")
    return "Friend request accepted";
  if (payload.type === "tab_invite_accepted") return "Tab invite accepted";
  if (payload.type === "expense_added") return "New expense added";
  if (payload.type === "expense_updated") return "Expense updated";
  if (payload.type === "expense_deleted") return "Expense deleted";
  if (payload.type === "expense_restored") return "Expense restored";
  if (payload.type === "expenses_bulk_imported") return "Expenses imported";
  if (payload.type === "expense_reaction") return "New reaction on expense";
  if (payload.type === "placeholder_merged") return "Placeholder merged with you";
  return "New notification";
}

function getPushBody(payload: {
  type: string;
  description?: string;
  amount?: string;
  amountDisplay?: string;
  tone?: string;
  tabName?: string;
  count?: number;
  forcePush?: boolean;
  recipientOweAmount?: string;
  descriptionChanged?: boolean;
  amountChanged?: boolean;
  fromUserName?: string | null;
  emoji?: string;
  currencySymbol?: string;
  recurringRuleId?: string;
  recurringRuleTitle?: string;
  ruleOwnerName?: string | null;
  editRulePath?: string;
  placeholderDisplayName?: string;
  targetDisplayName?: string;
}): string {
  if (payload.forcePush) return "This is a test notification";
  if (payload.type === "friend_request") return "New friend request";
  if (payload.type === "tab_invite") return "New tab invite";
  if (payload.type === "friend_request_accepted")
    return "Accepted your friend request";
  if (payload.type === "tab_invite_accepted") return "Joined your tab";
  if (payload.type === "expense_added") {
    if (payload.recurringRuleId && payload.ruleOwnerName) {
      const desc = payload.description || "an expense";
      const rule = payload.recurringRuleTitle || "a recurring rule";
      const sym = payload.currencySymbol ?? "$";
      const owe =
        payload.recipientOweAmount != null
          ? ` You owe ${sym}${payload.recipientOweAmount}.`
          : "";
      return `Tab created ${desc} based on ${rule} by ${payload.ruleOwnerName}.${owe}`;
    }
    const sym = payload.currencySymbol ?? "$";
    return payload.recipientOweAmount
      ? `You owe ${sym}${payload.recipientOweAmount}`
      : "New expense added";
  }
  if (payload.type === "recurring_rule_needs_fix") {
    const t = payload.tabName ?? "your tab";
    return `Update the recurring expense rule for ${t} so posting can resume.`;
  }
  if (payload.type === "expense_updated") {
    const sym = payload.currencySymbol ?? "$";
    const formatAmt = (a: string) =>
      a.includes(" (") ? a : `${sym}${a}`;
    const parts: string[] = [];
    if (payload.descriptionChanged && payload.description) {
      parts.push(`Description: ${payload.description}`);
    }
    if (payload.amountChanged) {
      const amt = payload.amount ? formatAmt(payload.amount) : "";
      const owe = payload.recipientOweAmount
        ? ` You owe ${sym}${payload.recipientOweAmount}`
        : "";
      parts.push(`Amount: ${amt}${owe}`);
    }
    return parts.length > 0 ? parts.join(". ") : "Expense updated";
  }
  if (payload.type === "expense_deleted") {
    return "Expense was deleted";
  }
  if (payload.type === "expense_restored") {
    return "Expense was restored";
  }
  if (
    payload.type === "expenses_bulk_imported" &&
    typeof payload.count === "number" &&
    payload.tabName
  ) {
    return `${payload.count} expense${payload.count !== 1 ? "s" : ""} imported to ${payload.tabName}`;
  }
  if (payload.type === "poke") return "Poke them back!";
  if (payload.type === "payment_reminder") {
    const { body } = getPaymentReminderPushCopy(
      typeof payload.tone === "string" ? payload.tone : "gentle",
      payload.fromUserName ?? null,
      typeof payload.amountDisplay === "string" ? payload.amountDisplay : "",
    );
    return body;
  }
  if (payload.type === "expense_reaction") {
    const desc = payload.description || "expense";
    return `${payload.fromUserName ?? "Someone"} reacted ${payload.emoji} to ${desc}`;
  }
  if (payload.type === "placeholder_merged") {
    const who = payload.fromUserName?.trim() || "Someone";
    const ph =
      typeof payload.placeholderDisplayName === "string"
        ? payload.placeholderDisplayName
        : "A placeholder";
    const tab = typeof payload.tabName === "string" ? payload.tabName : "a tab";
    return `${who} merged "${ph}" (placeholder) with your account in ${tab}.`;
  }
  return "You have a new notification";
}

function getNavigatePath(payload: {
  type: string;
  tabId?: string;
  expenseId?: string;
  friendTabId?: string;
  editRulePath?: string;
}): string {
  if (payload.type === "tab_invite") return "/tabs";
  if (payload.type === "friend_request_accepted" && payload.friendTabId) {
    return `/tabs/${payload.friendTabId}`;
  }
  if (payload.type === "tab_invite_accepted" && payload.tabId) {
    return `/tabs/${payload.tabId}`;
  }
  if (payload.type === "recurring_rule_needs_fix" && payload.editRulePath) {
    return payload.editRulePath.startsWith("/")
      ? payload.editRulePath
      : `/${payload.editRulePath}`;
  }
  if (
    (payload.type === "expense_added" ||
      payload.type === "expense_updated" ||
      payload.type === "expense_deleted" ||
      payload.type === "expense_restored" ||
      payload.type === "expense_reaction") &&
    payload.tabId
  ) {
    return payload.expenseId
      ? `/tabs/${payload.tabId}/expenses/${payload.expenseId}`
      : `/tabs/${payload.tabId}`;
  }
  if (payload.type === "expenses_bulk_imported" && payload.tabId) {
    return `/tabs/${payload.tabId}`;
  }
  if (payload.type === "placeholder_merged" && payload.tabId) {
    return `/tabs/${payload.tabId}`;
  }
  if (payload.type === "poke") return "/friends";
  if (payload.type === "payment_reminder" && payload.friendTabId) {
    return `/tabs/${payload.friendTabId}`;
  }
  return "/friends";
}

async function sendPushNotificationsInternal(
  userId: string,
  payload: unknown,
): Promise<{ removedInvalidSubscriptions: boolean }> {
  if (!vapidPublicKey || !vapidPrivateKey)
    return { removedInvalidSubscriptions: false };

  const subs = await db
    .select()
    .from(pushSubscription)
    .where(eq(pushSubscription.userId, userId))
    .limit(10);

  if (subs.length === 0) return { removedInvalidSubscriptions: false };

  const payloadObj =
    typeof payload === "string" ? JSON.parse(payload) : payload;
  log("info", "Sending push notifications", {
    userId,
    subscriptionCount: subs.length,
    type: payloadObj?.type,
    vapidPublicKey,
  });
  const title = getPushTitle(payloadObj);
  const body = getPushBody(payloadObj);
  const navigate = new URL(getNavigatePath(payloadObj), appBaseUrl).href;

  const pushPayload = JSON.stringify({
    web_push: 8030,
    notification: {
      title,
      body,
      navigate,
      silent: false,
      lang: "en-US",
      dir: "ltr",
    },
    title,
    body,
    ...payloadObj,
  });

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        pushPayload,
        { TTL: 86400, urgency: "high" },
      ),
    ),
  );
  const fulfilled = results.filter((r) => r.status === "fulfilled").length;
  const rejected = results.filter((r) => r.status === "rejected").length;
  let removedInvalidSubscriptions = false;
  if (rejected > 0) {
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const sub = subs[i];
      if (r.status === "rejected" && sub) {
        const err = r.reason as { statusCode?: number; body?: string };
        const statusCode = err?.statusCode;
        const body = err?.body;
        log("error", "Push send failed", {
          userId,
          error: String(r.reason),
          statusCode,
          body: body?.slice?.(0, 200),
          endpoint: sub.endpoint.slice(0, 60),
          vapidPublicKey,
        });
        const bodyStr = typeof body === "string" ? body : "";
        const isExpired = statusCode === 404 || statusCode === 410;
        const isVapidMismatch =
          (statusCode === 400 && bodyStr.includes("VapidPkHashMismatch")) ||
          (statusCode === 403 &&
            bodyStr.includes("VAPID credentials") &&
            bodyStr.includes("do not correspond"));
        if (isExpired || isVapidMismatch) {
          await db
            .delete(pushSubscription)
            .where(
              and(
                eq(pushSubscription.userId, userId),
                eq(pushSubscription.endpoint, sub.endpoint),
              ),
            );
          removedInvalidSubscriptions = true;
          log("info", "Removed invalid push subscription", {
            userId,
            endpoint: sub.endpoint.slice(0, 60),
            reason: isVapidMismatch ? "VAPID mismatch" : "expired",
            vapidPublicKey,
          });
        }
      }
    }
  }
  log("info", "Push notifications sent", { userId, fulfilled, rejected });
  return { removedInvalidSubscriptions };
}

export async function sendPushNotifications(
  userId: string,
  payload: NotificationPayload,
  options?: { forcePush?: boolean },
): Promise<{ removedInvalidSubscriptions: boolean }> {
  const payloadWithForce = options?.forcePush
    ? { ...payload, forcePush: true as const }
    : payload;
  return sendPushNotificationsInternal(userId, payloadWithForce);
}
