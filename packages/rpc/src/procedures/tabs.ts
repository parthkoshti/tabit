import { z } from "zod";
import {
  createTabSchema,
  addMemberSchema,
  updateTabSchema,
  recordSettlementSchema,
  updateSettlementSchema,
  createTabPlaceholderSchema,
  renameTabPlaceholderSchema,
  mergeTabPlaceholderSchema,
} from "models";
import { tabService, settlementService } from "services";
import { authed } from "../auth-middleware.js";
import { unwrap } from "../utils.js";

export const tabsProcedures = {
  list: authed.handler(async ({ context }) => {
    const data = unwrap(await tabService.getTabsForUser(context.userId!));
    return { tabs: data.tabs };
  }),

  get: authed
    .input(z.object({ tabId: z.string() }))
    .handler(async ({ context, input }) => {
      return { tab: unwrap(await tabService.getWithMembers(input.tabId, context.userId!)) };
    }),

  create: authed
    .input(createTabSchema)
    .handler(async ({ context, input }) => {
      const data = unwrap(
        await tabService.create(input.name, context.userId!, input.currency),
      );
      return { tabId: data.tabId };
    }),

  update: authed
    .input(
      z.object({
        tabId: z.string(),
        updates: updateTabSchema,
      }),
    )
    .handler(async ({ context, input }) => {
      const updates: { name?: string; currency?: string } = {};
      if (input.updates.name !== undefined) updates.name = input.updates.name.trim();
      if (input.updates.currency !== undefined) {
        updates.currency = input.updates.currency.trim();
      }
      unwrap(await tabService.update(input.tabId, context.userId!, updates));
      return {};
    }),

  addMember: authed
    .input(
      z.object({
        tabId: z.string(),
        body: addMemberSchema.omit({ tabId: true }),
      }),
    )
    .handler(async ({ context, input }) => {
      unwrap(
        await tabService.addMember(
          input.tabId,
          context.userId!,
          input.body.email,
          input.body.role,
        ),
      );
      return {};
    }),

  removeMember: authed
    .input(z.object({ tabId: z.string(), userId: z.string() }))
    .handler(async ({ context, input }) => {
      unwrap(
        await tabService.removeMember(input.tabId, context.userId!, input.userId),
      );
      return {};
    }),

  getBalances: authed
    .input(z.object({ tabId: z.string() }))
    .handler(async ({ context, input }) => {
      return {
        balances: unwrap(await tabService.getBalancesForTab(input.tabId, context.userId!)),
      };
    }),

  getSharedGroupTabs: authed
    .input(z.object({ tabId: z.string() }))
    .handler(async ({ context, input }) => {
      return {
        tabs: unwrap(
          await tabService.getSharedGroupTabsForDirectTab(input.tabId, context.userId!),
        ),
      };
    }),

  createPlaceholder: authed
    .input(
      z.object({
        tabId: z.string(),
        body: createTabPlaceholderSchema,
      }),
    )
    .handler(async ({ context, input }) => {
      const data = unwrap(
        await tabService.createPlaceholder(
          input.tabId,
          context.userId!,
          input.body.displayName,
        ),
      );
      return { participantId: data.participantId };
    }),

  renamePlaceholder: authed
    .input(
      z.object({
        tabId: z.string(),
        participantId: z.string(),
        body: renameTabPlaceholderSchema,
      }),
    )
    .handler(async ({ context, input }) => {
      unwrap(
        await tabService.renamePlaceholder(
          input.tabId,
          input.participantId,
          context.userId!,
          input.body.displayName,
        ),
      );
      return {};
    }),

  mergePlaceholder: authed
    .input(
      z.object({
        tabId: z.string(),
        participantId: z.string(),
        body: mergeTabPlaceholderSchema,
      }),
    )
    .handler(async ({ context, input }) => {
      return unwrap(
        await tabService.mergePlaceholder(
          input.tabId,
          input.participantId,
          context.userId!,
          input.body.targetUserId,
        ),
      );
    }),

  listSettlements: authed
    .input(z.object({ tabId: z.string() }))
    .handler(async ({ context, input }) => {
      return {
        settlements: unwrap(
          await settlementService.getForTab(input.tabId, context.userId!),
        ),
      };
    }),

  getSettlement: authed
    .input(z.object({ tabId: z.string(), settlementId: z.string() }))
    .handler(async ({ context, input }) => {
      return {
        settlement: unwrap(
          await settlementService.getById(
            input.tabId,
            input.settlementId,
            context.userId!,
          ),
        ),
      };
    }),

  getSettlementAuditLog: authed
    .input(z.object({ tabId: z.string(), settlementId: z.string() }))
    .handler(async ({ context, input }) => {
      return {
        auditLog: unwrap(
          await settlementService.getAuditLog(
            input.tabId,
            input.settlementId,
            context.userId!,
          ),
        ),
      };
    }),

  recordSettlement: authed
    .input(
      z.object({
        tabId: z.string(),
        body: recordSettlementSchema,
      }),
    )
    .handler(async ({ context, input }) => {
      const b = input.body;
      unwrap(
        await settlementService.record(
          input.tabId,
          b.fromUserId ?? null,
          b.toUserId ?? null,
          b.amount,
          context.userId!,
          b.currency,
          b.originalAmount,
          b.settlementDate,
          b.fromParticipantId,
          b.toParticipantId,
        ),
      );
      return {};
    }),

  updateSettlement: authed
    .input(
      z.object({
        tabId: z.string(),
        settlementId: z.string(),
        body: updateSettlementSchema,
      }),
    )
    .handler(async ({ context, input }) => {
      const b = input.body;
      unwrap(
        await settlementService.update(
          input.tabId,
          input.settlementId,
          b.fromUserId ?? null,
          b.toUserId ?? null,
          b.amount,
          context.userId!,
          b.currency,
          b.originalAmount,
          b.settlementDate,
          b.fromParticipantId,
          b.toParticipantId,
        ),
      );
      return {};
    }),

  deleteSettlement: authed
    .input(z.object({ tabId: z.string(), settlementId: z.string() }))
    .handler(async ({ context, input }) => {
      unwrap(
        await settlementService.delete(
          input.tabId,
          input.settlementId,
          context.userId!,
        ),
      );
      return {};
    }),
};
