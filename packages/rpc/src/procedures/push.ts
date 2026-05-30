import { z } from "zod";
import { push as pushData } from "data";
import { enqueueNotification } from "queue";
import { authed } from "../auth-middleware.js";

const pushSubscriptionSchema = z.object({
  endpoint: z.string(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

export const pushProcedures = {
  subscribe: authed
    .input(pushSubscriptionSchema)
    .handler(async ({ context, input }) => {
      await pushData.insert({
        userId: context.userId!,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: context.headers.get("User-Agent") ?? null,
      });
      return {};
    }),

  unsubscribe: authed
    .input(z.object({ endpoint: z.string() }))
    .handler(async ({ context, input }) => {
      await pushData.deleteByUserAndEndpoint(context.userId!, input.endpoint);
      return {};
    }),

  test: authed.handler(async ({ context }) => {
    await enqueueNotification(
      context.userId!,
      {
        type: "friend_request",
        requestId: "test-" + Date.now(),
        fromUserId: context.userId!,
        fromUserName: "Test",
        fromUserUsername: "test",
        createdAt: new Date().toISOString(),
      },
      { forcePush: true },
    );
    return {};
  }),

  testTabInvite: authed.handler(async ({ context }) => {
    await enqueueNotification(
      context.userId!,
      {
        type: "tab_invite",
        requestId: "test-" + Date.now(),
        tabId: "test-tab",
        tabName: "Test Tab",
        fromUserId: context.userId!,
        fromUserName: "Test",
        fromUserUsername: "test",
        createdAt: new Date().toISOString(),
      },
      { forcePush: true },
    );
    return {};
  }),
};
