import { z } from "zod";
import { recurringExpenseService } from "services";
import { authed } from "../auth-middleware.js";
import { unwrap } from "../utils.js";

export const recurringExpensesProcedures = {
  listForTab: authed
    .input(z.object({ tabId: z.string() }))
    .handler(async ({ context, input }) => {
      return {
        rules: unwrap(
          await recurringExpenseService.listForTab(input.tabId, context.userId!),
        ),
      };
    }),

  createForTab: authed
    .input(
      z.object({
        tabId: z.string(),
        body: z.record(z.unknown()),
      }),
    )
    .handler(async ({ context, input }) => {
      const data = unwrap(
        await recurringExpenseService.create(
          input.tabId,
          context.userId!,
          input.body,
        ),
      );
      return { ruleId: data.ruleId };
    }),

  get: authed
    .input(z.object({ ruleId: z.string() }))
    .handler(async ({ context, input }) => {
      return {
        rule: unwrap(
          await recurringExpenseService.getById(input.ruleId, context.userId!),
        ),
      };
    }),

  update: authed
    .input(
      z.object({
        ruleId: z.string(),
        body: z.record(z.unknown()),
      }),
    )
    .handler(async ({ context, input }) => {
      unwrap(
        await recurringExpenseService.update(
          input.ruleId,
          context.userId!,
          input.body,
        ),
      );
      return {};
    }),

  delete: authed
    .input(z.object({ ruleId: z.string() }))
    .handler(async ({ context, input }) => {
      unwrap(
        await recurringExpenseService.deleteRule(input.ruleId, context.userId!),
      );
      return {};
    }),
};
