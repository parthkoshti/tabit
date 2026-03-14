import { Redis } from "ioredis";
import type { NotificationPayload } from "models";
import { log } from "./logger.js";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(redisUrl);
    redis.on("connect", () => log("info", "Redis connected"));
    redis.on("error", (err) => log("error", "Redis error", { error: String(err) }));
  }
  return redis;
}

function notificationLogData(
  userId: string,
  payload: NotificationPayload
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    userId,
    type: payload.type,
    channel: `notifications:user:${userId}`,
  };
  if ("requestId" in payload && payload.requestId) base.requestId = payload.requestId;
  if ("tabId" in payload && payload.tabId) base.tabId = payload.tabId;
  if ("expenseId" in payload && payload.expenseId) base.expenseId = payload.expenseId;
  if ("friendTabId" in payload && payload.friendTabId) base.friendTabId = payload.friendTabId;
  if ("count" in payload && payload.count != null) base.count = payload.count;
  return base;
}

export async function publishNotification(
  userId: string,
  payload: NotificationPayload,
  options?: { forcePush?: boolean }
): Promise<void> {
  const client = getRedis();
  const channel = `notifications:user:${userId}`;
  const toPublish = options?.forcePush ? { ...payload, forcePush: true } : payload;
  await client.publish(channel, JSON.stringify(toPublish));
  log("info", "Notification published", notificationLogData(userId, payload));
}
