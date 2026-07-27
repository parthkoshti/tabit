import { z } from "zod";
import {
  createExpenseSchema,
  createRecurringExpenseRuleSchema,
  type CreateRecurringExpenseRuleInput,
} from "models";
import { CURRENCY_CODES } from "shared";
import { tab } from "data";
import { convertToTabCurrency, expenseService } from "services";
import { authed } from "../auth-middleware.js";
import { ORPCError } from "@orpc/server";
import { unwrap, zodFirstError } from "../utils.js";
import { log, spanEvent } from "otel";

function bodyForExpenseZodParse(
  body: Record<string, unknown>,
  tabId: string,
  userId: string,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...body, tabId };
  const pc = merged["paidByParticipantId"];
  const hasParticipant = typeof pc === "string" && pc.trim().length > 0;
  const paidBy = merged["paidById"];
  const missingPaidBy =
    paidBy === undefined ||
    paidBy === null ||
    (typeof paidBy === "string" && paidBy.trim() === "");
  if (!hasParticipant && missingPaidBy) {
    merged["paidById"] = userId;
  }
  return merged;
}

const expenseFilterSchema = z.enum(["all", "involved", "owed", "owe"]);

export const expensesProcedures = {
  list: authed
    .input(
      z.object({
        tabId: z.string(),
        limit: z.number().int().optional(),
        offset: z.number().int().optional(),
        filter: expenseFilterSchema.optional(),
        search: z.string().max(200).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const options: {
        limit?: number;
        offset?: number;
        filter?: "all" | "involved" | "owed" | "owe";
        userId?: string;
        search?: string;
      } = {};
      if (input.limit != null) {
        options.limit = input.limit;
        options.offset = input.offset ?? 0;
      }
      if (input.filter && input.filter !== "all") {
        options.filter = input.filter;
        options.userId = context.userId!;
      }
      const search = input.search?.trim();
      if (search) {
        options.search = search;
      }
      const data = unwrap(
        await expenseService.getForTab(input.tabId, context.userId!, options),
      );
      return { expenses: data.expenses, total: data.total };
    }),

  fxPreview: authed
    .input(
      z.object({
        tabId: z.string(),
        amount: z.number().positive(),
        currency: z.string(),
        expenseDate: z.string().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const upper = input.currency.trim().toUpperCase();
      if (!(CURRENCY_CODES as readonly string[]).includes(upper)) {
        throw new ORPCError("BAD_REQUEST", { message: "Invalid currency code" });
      }
      const expenseDate = input.expenseDate
        ? new Date(input.expenseDate)
        : new Date();
      if (Number.isNaN(expenseDate.getTime())) {
        throw new ORPCError("BAD_REQUEST", { message: "Invalid expenseDate" });
      }
      const isMember = await tab.isMember(input.tabId, context.userId!);
      if (!isMember) {
        throw new ORPCError("FORBIDDEN", { message: "Not a member" });
      }
      const tabCurrency = (await tab.getCurrency(input.tabId)) ?? "USD";
      const conv = await convertToTabCurrency({
        originalAmount: input.amount,
        from: upper,
        tabCurrency,
        asOfDate: expenseDate,
      });
      if (!conv.success) {
        throw new ORPCError(
          conv.status === 503 ? "INTERNAL_SERVER_ERROR" : "BAD_REQUEST",
          { message: conv.error },
        );
      }
      return {
        amountTab: conv.data.amountTab,
        fxRateDate: conv.data.rateDate,
        tabCurrency,
      };
    }),

  get: authed
    .input(z.object({ tabId: z.string(), expenseId: z.string() }))
    .handler(async ({ context, input }) => {
      return {
        expense: unwrap(
          await expenseService.getById(input.tabId, input.expenseId, context.userId!),
        ),
      };
    }),

  getAuditLog: authed
    .input(z.object({ tabId: z.string(), expenseId: z.string() }))
    .handler(async ({ context, input }) => {
      return {
        auditLog: unwrap(
          await expenseService.getAuditLog(
            input.tabId,
            input.expenseId,
            context.userId!,
          ),
        ),
      };
    }),

  create: authed
    .input(
      z.object({
        tabId: z.string(),
        body: z.record(z.unknown()),
      }),
    )
    .handler(async ({ context, input }) => {
      const startedAtMs = Date.now();
      const body = input.body as Record<string, unknown>;
      spanEvent("expense.create.request.start", {
        tabId: input.tabId,
        hasRecurringRule: body.createRecurringRule != null,
      });

      try {
        const parsed = createExpenseSchema.safeParse(
          bodyForExpenseZodParse(body, input.tabId, context.userId!),
        );
        if (!parsed.success) {
          const validationError = zodFirstError(parsed.error);
          log("warn", "Expense create request validation failed", {
            tabId: input.tabId,
            performedById: context.userId,
            error: validationError,
            durationMs: Date.now() - startedAtMs,
          });
          throw new ORPCError("BAD_REQUEST", { message: validationError });
        }

        let createRecurringRule: CreateRecurringExpenseRuleInput | undefined;
        if (body.createRecurringRule != null) {
          const crParsed = createRecurringExpenseRuleSchema.safeParse(
            body.createRecurringRule,
          );
          if (!crParsed.success) {
            const validationError = zodFirstError(crParsed.error);
            log("warn", "Expense recurring rule validation failed", {
              tabId: input.tabId,
              performedById: context.userId,
              error: validationError,
              durationMs: Date.now() - startedAtMs,
            });
            throw new ORPCError("BAD_REQUEST", {
              message: validationError,
            });
          }
          createRecurringRule = crParsed.data;
        }

        const data = unwrap(
          await expenseService.create(
            {
              ...parsed.data,
              participantIds: body.participantIds as string[] | undefined,
              ...(createRecurringRule ? { createRecurringRule } : {}),
            },
            context.userId!,
          ),
        );

        return {
          expenseId: data.expenseId,
          tabId: data.tabId,
          amount: data.amount,
          description: data.description,
          tabName: data.tabName,
          currency: data.currency,
          expenseCurrency: data.expenseCurrency,
          originalAmount: data.originalAmount,
          fxRateDate: data.fxRateDate,
          participants: data.participants,
        };
      } catch (err) {
        log("error", "Expense create request failed", {
          tabId: input.tabId,
          performedById: context.userId,
          error: err instanceof Error ? err.message : String(err),
          durationMs: Date.now() - startedAtMs,
        });
        throw err;
      }
    }),

  createBulk: authed
    .input(
      z.object({
        tabId: z.string(),
        expenses: z.array(z.record(z.unknown())),
      }),
    )
    .handler(async ({ context, input }) => {
      const data = unwrap(
        await expenseService.createBulk(
          input.tabId,
          input.expenses,
          context.userId!,
        ),
      );
      return {
        imported: data.imported,
        failed: data.failed,
        errors: data.errors,
      };
    }),

  update: authed
    .input(
      z.object({
        tabId: z.string(),
        expenseId: z.string(),
        body: z.record(z.unknown()),
      }),
    )
    .handler(async ({ context, input }) => {
      const body = input.body as Record<string, unknown>;
      const parsed = createExpenseSchema.safeParse(
        bodyForExpenseZodParse(body, input.tabId, context.userId!),
      );
      if (!parsed.success) {
        throw new ORPCError("BAD_REQUEST", { message: zodFirstError(parsed.error) });
      }
      unwrap(
        await expenseService.update(
          input.tabId,
          input.expenseId,
          {
            ...parsed.data,
            participantIds: body.participantIds as string[] | undefined,
          },
          context.userId!,
        ),
      );
      return {};
    }),

  delete: authed
    .input(z.object({ tabId: z.string(), expenseId: z.string() }))
    .handler(async ({ context, input }) => {
      unwrap(
        await expenseService.delete(input.tabId, input.expenseId, context.userId!),
      );
      return {};
    }),

  restore: authed
    .input(z.object({ tabId: z.string(), expenseId: z.string() }))
    .handler(async ({ context, input }) => {
      unwrap(
        await expenseService.restore(input.tabId, input.expenseId, context.userId!),
      );
      return {};
    }),

  addReaction: authed
    .input(
      z.object({
        tabId: z.string(),
        expenseId: z.string(),
        emoji: z.string(),
      }),
    )
    .handler(async ({ context, input }) => {
      unwrap(
        await expenseService.addReaction(
          input.tabId,
          input.expenseId,
          input.emoji,
          context.userId!,
        ),
      );
      return {};
    }),

  removeReaction: authed
    .input(z.object({ tabId: z.string(), expenseId: z.string() }))
    .handler(async ({ context, input }) => {
      unwrap(
        await expenseService.removeReaction(
          input.tabId,
          input.expenseId,
          context.userId!,
        ),
      );
      return {};
    }),
};
