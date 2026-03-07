import { z } from "zod";

export const splitTypeSchema = z.enum(["equal", "custom"]);
export type SplitType = z.infer<typeof splitTypeSchema>;

export const createExpenseSchema = z.object({
  tabId: z.string(),
  amount: z.number().positive(),
  description: z.string().min(1).max(500),
  paidById: z.string(),
  splitType: splitTypeSchema.default("equal"),
  expenseDate: z.coerce.date().optional().default(() => new Date()),
  splits: z
    .array(
      z.object({
        userId: z.string(),
        amount: z.number().nonnegative(),
      })
    )
    .optional(),
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
    })
  ),
  paidBy: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string().nullable(),
  }),
});

export type ExpenseWithSplits = z.infer<typeof expenseWithSplitsSchema>;
