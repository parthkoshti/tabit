import { Redis } from "ioredis";
import type { NotificationPayload } from "models";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(redisUrl);
  }
  return redis;
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
}
