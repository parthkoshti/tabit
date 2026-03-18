import { Redis } from "ioredis";
import type { NotificationPayload } from "models";
import {
  createExpenseAddedNotificationPayload,
  createExpenseUpdatedNotificationPayload,
  createExpenseDeletedNotificationPayload,
  createExpenseRestoredNotificationPayload,
  createExpensesBulkImportedNotificationPayload,
  createExpenseReactionNotificationPayload,
  createFriendRequestNotificationPayload,
  createFriendRequestAcceptedNotificationPayload,
  createPokeNotificationPayload,
  createTabInviteNotificationPayload,
  createTabInviteAcceptedNotificationPayload,
} from "models";

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
    redis = new Redis(redisUrl);
    redis.on("error", (err) => {
      console.error("Redis error in services:", String(err));
    });
  }
  return redis;
}

async function publish(userId: string, payload: NotificationPayload): Promise<void> {
  const client = getRedis();
  const channel = `notifications:user:${userId}`;
  await client.publish(channel, JSON.stringify(payload));
}

export const notificationService = {
  publishExpenseAddedToUser: async (
    userId: string,
    params: {
      tabId: string;
      expenseId: string;
      tabName: string;
      isDirect?: boolean;
      fromUserId: string;
      fromUserName: string | null;
      description: string;
      amount: string;
      recipientOweAmount?: string;
      createdAt: Date;
    },
  ): Promise<void> => {
    const payload = createExpenseAddedNotificationPayload(params);
    await publish(userId, payload);
  },

  publishExpenseUpdatedToUser: async (
    userId: string,
    params: {
      tabId: string;
      expenseId: string;
      tabName: string;
      isDirect?: boolean;
      fromUserId: string;
      fromUserName: string | null;
      description: string;
      amount: string;
      recipientOweAmount?: string;
      descriptionChanged?: boolean;
      amountChanged?: boolean;
      previousDescription?: string;
      createdAt: Date;
    },
  ): Promise<void> => {
    const payload = createExpenseUpdatedNotificationPayload(params);
    await publish(userId, payload);
  },

  publishExpenseDeletedToUser: async (
    userId: string,
    params: {
      tabId: string;
      expenseId: string;
      tabName: string;
      isDirect?: boolean;
      fromUserId: string;
      fromUserName: string | null;
      description: string;
      amount: string;
      deletedAt: Date;
      createdAt: Date;
    },
  ): Promise<void> => {
    const payload = createExpenseDeletedNotificationPayload(params);
    await publish(userId, payload);
  },

  publishExpenseRestoredToUser: async (
    userId: string,
    params: {
      tabId: string;
      expenseId: string;
      tabName: string;
      isDirect?: boolean;
      fromUserId: string;
      fromUserName: string | null;
      description: string;
      amount: string;
      createdAt: Date;
    },
  ): Promise<void> => {
    const payload = createExpenseRestoredNotificationPayload(params);
    await publish(userId, payload);
  },

  publishExpensesBulkImportedToUser: async (
    userId: string,
    params: {
      tabId: string;
      tabName: string;
      fromUserId: string;
      fromUserName: string | null;
      count: number;
      createdAt: Date;
    },
  ): Promise<void> => {
    const payload = createExpensesBulkImportedNotificationPayload(params);
    await publish(userId, payload);
  },

  publishExpenseReactionToUser: async (
    userId: string,
    params: {
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
    },
  ): Promise<void> => {
    const payload = createExpenseReactionNotificationPayload(params);
    await publish(userId, payload);
  },

  publishFriendRequest: async (params: {
    userId: string;
    requestId: string;
    fromUserId: string;
    fromUserName: string | null;
    fromUserUsername: string | null;
    createdAt: Date;
  }): Promise<void> => {
    const payload = createFriendRequestNotificationPayload(params);
    await publish(params.userId, payload);
  },

  publishFriendRequestAccepted: async (params: {
    userId: string;
    requestId: string;
    friendTabId: string;
    fromUserId: string;
    fromUserName: string | null;
    fromUserUsername: string | null;
    createdAt: Date;
  }): Promise<void> => {
    const payload = createFriendRequestAcceptedNotificationPayload(params);
    await publish(params.userId, payload);
  },

  publishPoke: async (params: {
    userId: string;
    friendTabId: string;
    fromUserId: string;
    fromUserName: string | null;
    fromUserUsername: string | null;
    createdAt: Date;
  }): Promise<void> => {
    const payload = createPokeNotificationPayload(params);
    await publish(params.userId, payload);
  },

  publishTabInvite: async (params: {
    userId: string;
    requestId: string;
    tabId: string;
    tabName: string;
    fromUserId: string;
    fromUserName: string | null;
    fromUserUsername: string | null;
    createdAt: Date;
  }): Promise<void> => {
    const payload = createTabInviteNotificationPayload(params);
    await publish(params.userId, payload);
  },

  publishTabInviteAccepted: async (params: {
    userId: string;
    requestId: string;
    tabId: string;
    tabName: string;
    fromUserId: string;
    fromUserName: string | null;
    fromUserUsername: string | null;
    createdAt: Date;
  }): Promise<void> => {
    const payload = createTabInviteAcceptedNotificationPayload(params);
    await publish(params.userId, payload);
  },
};
