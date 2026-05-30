import { z } from "zod";
import { tabInviteService } from "services";
import { authed, base } from "../auth-middleware.js";
import { unwrap } from "../utils.js";

export const tabInvitesProcedures = {
  getByToken: base
    .input(z.object({ token: z.string() }))
    .handler(async ({ input }) => {
      const data = unwrap(await tabInviteService.getByToken(input.token.trim()));
      return {
        tab: data.tab,
        creator: data.creator,
        tabId: data.tabId,
      };
    }),

  joinByToken: authed
    .input(z.object({ token: z.string() }))
    .handler(async ({ context, input }) => {
      const data = unwrap(
        await tabInviteService.joinByToken(context.userId!, input.token.trim()),
      );
      return { tabId: data.tabId, alreadyMember: data.alreadyMember };
    }),

  getToken: authed
    .input(z.object({ tabId: z.string() }))
    .handler(async ({ context, input }) => {
      const data = unwrap(
        await tabInviteService.getToken(context.userId!, input.tabId),
      );
      return { url: data.url };
    }),

  getPendingRequests: authed.handler(async ({ context }) => {
    const data = unwrap(
      await tabInviteService.getPendingRequests(context.userId!),
    );
    return { requests: data.requests };
  }),

  sendRequest: authed
    .input(z.object({ tabId: z.string(), username: z.string() }))
    .handler(async ({ context, input }) => {
      unwrap(
        await tabInviteService.sendRequest(
          context.userId!,
          input.tabId,
          input.username.trim(),
        ),
      );
      return {};
    }),

  acceptRequest: authed
    .input(z.object({ requestId: z.string() }))
    .handler(async ({ context, input }) => {
      const data = unwrap(
        await tabInviteService.acceptRequest(context.userId!, input.requestId),
      );
      return { tabId: data.tabId, alreadyMember: data.alreadyMember };
    }),

  rejectRequest: authed
    .input(z.object({ requestId: z.string() }))
    .handler(async ({ context, input }) => {
      unwrap(
        await tabInviteService.rejectRequest(context.userId!, input.requestId),
      );
      return {};
    }),
};
