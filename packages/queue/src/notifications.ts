import { Queue, Worker, type Processor } from "bullmq";
import type { NotificationPayload } from "models";
import { sendDiscordWebhook } from "shared";
import { getRedisConnection } from "./connection.js";

export const NOTIFICATIONS_QUEUE_NAME = "notifications";

export type NotificationJobData = {
  userId: string;
  payload: NotificationPayload;
  forcePush?: boolean;
};

let notificationsQueue: Queue<NotificationJobData> | null = null;

export function getNotificationsQueue(): Queue<NotificationJobData> {
  if (!notificationsQueue) {
    notificationsQueue = new Queue<NotificationJobData>(
      NOTIFICATIONS_QUEUE_NAME,
      {
        connection: getRedisConnection(),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 2000 },
          removeOnComplete: 1000,
          removeOnFail: 5000,
        },
      },
    );
  }
  return notificationsQueue;
}

export async function enqueueNotification(
  userId: string,
  payload: NotificationPayload,
  options?: { forcePush?: boolean },
): Promise<void> {
  const queue = getNotificationsQueue();
  await queue.add("deliver", {
    userId,
    payload,
    forcePush: options?.forcePush,
  });
}

export type NotificationDeliverProcessor = Processor<NotificationJobData>;

export function createNotificationsWorker(
  processor: NotificationDeliverProcessor,
): Worker<NotificationJobData> {
  const worker = new Worker<NotificationJobData>(
    NOTIFICATIONS_QUEUE_NAME,
    processor,
    {
      connection: getRedisConnection(),
      concurrency: 10,
    },
  );

  worker.on("failed", (job, err) => {
    if (!job || job.attemptsMade < (job.opts.attempts ?? 3)) return;
    sendDiscordWebhook(
      `[workers] Notification job failed after retries: userId=${job.data.userId} type=${job.data.payload.type} error=${String(err)}`,
    );
  });

  return worker;
}
