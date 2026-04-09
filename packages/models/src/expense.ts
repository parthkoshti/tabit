import { z } from "zod";

export const splitTypeSchema = z.enum(["equal", "custom", "percent", "shares"]);
export type SplitType = z.infer<typeof splitTypeSchema>;

export const expenseSplitLineInputSchema = z.object({
  userId: z.string(),
  amount: z.number().nonnegative().optional(),
  weight: z.number().positive().optional(),
});

export const createExpenseSchema = z
  .object({
    tabId: z.string(),
    /** Amount in `currency` (tab currency when omitted / same as tab). */
    amount: z.number().positive(),
    /** ISO 4217 code; defaults to tab currency on the server. */
    currency: z.string().min(1).max(10).optional(),
    description: z.string().min(1).max(500),
    paidById: z.string(),
    splitType: splitTypeSchema.default("equal"),
    expenseDate: z.coerce.date().optional().default(() => new Date()),
    splits: z.array(expenseSplitLineInputSchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.splitType === "equal") return;

    if (!data.splits || data.splits.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "This split type requires a splits array",
        path: [],
      });
      return;
    }

    if (data.splitType === "custom") {
      for (let i = 0; i < data.splits.length; i++) {
        if (data.splits[i]!.amount === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Each split must include an amount",
            path: ["splits", i, "amount"],
          });
        }
      }
    }

    if (data.splitType === "percent") {
      for (let i = 0; i < data.splits.length; i++) {
        if (data.splits[i]!.weight === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Each split must include a percentage weight",
            path: ["splits", i, "weight"],
          });
        }
      }
      const sum = data.splits.reduce((a, s) => a + (s.weight ?? 0), 0);
      if (Math.abs(sum - 100) > 0.01) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Percentages must sum to 100",
          path: [],
        });
      }
    }

    if (data.splitType === "shares") {
      for (let i = 0; i < data.splits.length; i++) {
        const w = data.splits[i]!.weight;
        if (w === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Each split must include a share count",
            path: ["splits", i, "weight"],
          });
        } else if (!Number.isInteger(w)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Share counts must be whole numbers",
            path: ["splits", i, "weight"],
          });
        }
      }
    }
  });

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const expenseSchema = z.object({
  id: z.string(),
  tabId: z.string(),
  paidById: z.string(),
  amount: z.number(),
  description: z.string(),
  splitType: splitTypeSchema,
  expenseDate: z.coerce.date(),
  createdAt: z.date(),
});

export type Expense = z.infer<typeof expenseSchema>;

export const expenseSplitSchema = z.object({
  id: z.string(),
  expenseId: z.string(),
  userId: z.string(),
  amount: z.number(),
  weight: z.number().nullable().optional(),
});

export type ExpenseSplit = z.infer<typeof expenseSplitSchema>;

export const expenseWithSplitsSchema = expenseSchema.extend({
  splits: z.array(
    expenseSplitSchema.extend({
      user: z.object({
        id: z.string(),
        email: z.string(),
        name: z.string().nullable(),
      }),
    }),
  ),
  paidBy: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string().nullable(),
  }),
});

export type ExpenseWithSplits = z.infer<typeof expenseWithSplitsSchema>;
