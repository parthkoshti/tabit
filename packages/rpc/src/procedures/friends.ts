import { z } from "zod";
import { paymentReminderRequestSchema } from "models";
import { friendService } from "services";
import { authed } from "../auth-middleware.js";
import { unwrap } from "../utils.js";

export const friendsProcedures = {
  getPendingRequests: authed.handler(async ({ context }) => {
    const result = await friendService.getPendingRequests(context.userId!);
    return { requests: unwrap(result).requests };
  }),

  sendRequest: authed
    .input(z.object({ username: z.string() }))
    .handler(async ({ context, input }) => {
      unwrap(await friendService.sendRequest(context.userId!, input.username));
      return {};
    }),

  acceptRequest: authed
    .input(z.object({ requestId: z.string() }))
    .handler(async ({ context, input }) => {
      const data = unwrap(
        await friendService.acceptRequest(input.requestId, context.userId!),
      );
      return { friendTabId: data.friendTabId };
    }),

  rejectRequest: authed
    .input(z.object({ requestId: z.string() }))
    .handler(async ({ context, input }) => {
      unwrap(await friendService.rejectRequest(input.requestId, context.userId!));
      return {};
    }),

  getToken: authed.handler(async ({ context }) => {
    const data = unwrap(await friendService.getInviteToken(context.userId!));
    return { token: data.token, url: data.url };
  }),

  addByToken: authed
    .input(z.object({ token: z.string() }))
    .handler(async ({ context, input }) => {
      const data = unwrap(
        await friendService.addByToken(context.userId!, input.token),
      );
      return {
        friendTabId: data.friendTabId,
        alreadyFriends: data.alreadyFriends,
      };
    }),

  search: authed
    .input(
      z.object({
        q: z.string(),
        includeFriends: z.boolean().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const users = unwrap(
        await friendService.searchUsers(
          context.userId!,
          input.q,
          input.includeFriends ?? false,
        ),
      );
      return { users };
    }),

  list: authed.handler(async ({ context }) => {
    const data = unwrap(await friendService.getFriends(context.userId!));
    return { friends: data.friends };
  }),

  poke: authed
    .input(z.object({ friendTabId: z.string() }))
    .handler(async ({ context, input }) => {
      unwrap(await friendService.poke(context.userId!, input.friendTabId));
      return {};
    }),

  sendPaymentReminder: authed
    .input(paymentReminderRequestSchema)
    .handler(async ({ context, input }) => {
      unwrap(
        await friendService.sendPaymentReminder(
          context.userId!,
          input.friendTabId,
          input.tone,
        ),
      );
      return {};
    }),
};
