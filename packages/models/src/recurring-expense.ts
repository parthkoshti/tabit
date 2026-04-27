import { z } from "zod";
import { expenseSplitLineInputSchema, splitTypeSchema } from "./expense.js";

/** ISO weekday 1 = Monday ... 7 = Sunday (Luxon compatible). */
export const recurringWeekdaySchema = z.number().int().min(1).max(7);

export const recurringScheduleIntervalDaysSchema = z.object({
  type: z.literal("interval_days"),
  intervalDays: z.number().int().min(1).max(365),
  /** First anchor calendar date (YYYY-MM-DD) in creator TZ — occurrences from rule start use this + interval. */
  anchorDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const recurringScheduleMonthlyNthSchema = z.object({
  type: z.literal("monthly_nth"),
  /** 1–31; short months use last day of month when day exceeds month length. */
  dayOfMonth: z.number().int().min(1).max(31),
});

export const recurringScheduleWeeklySchema = z.object({
  type: z.literal("weekly"),
  weekdays: z.array(recurringWeekdaySchema).min(1).max(7),
});

export const recurringScheduleSchema = z.discriminatedUnion("type", [
  recurringScheduleIntervalDaysSchema,
  recurringScheduleMonthlyNthSchema,
  recurringScheduleWeeklySchema,
]);

export type RecurringSchedule = z.infer<typeof recurringScheduleSchema>;

/** Frozen fields copied into each posted expense. */
export const recurringExpenseTemplateSchema = z
  .object({
    amount: z.number().positive(),
    currency: z.string().min(1).max(10),
    description: z.string().min(1).max(500),
    paidById: z.string(),
    splitType: splitTypeSchema.default("equal"),
    splits: z.array(expenseSplitLineInputSchema).optional(),
    participantIds: z.array(z.string()).min(1),
  })
  .superRefine((data, ctx) => {
    if (data.splitType === "equal") return;
    if (!data.splits || data.splits.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "This split type requires a splits array",
        path: [],
      });
    }
  });

export type RecurringExpenseTemplate = z.infer<typeof recurringExpenseTemplateSchema>;

export const recurringRuleStatusSchema = z.enum([
  "active",
  "paused_user",
  "paused_needs_fix",
]);

export type RecurringRuleStatus = z.infer<typeof recurringRuleStatusSchema>;

export const createRecurringExpenseRuleSchema = z.object({
  schedule: recurringScheduleSchema,
  template: recurringExpenseTemplateSchema,
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  maxCount: z.number().int().positive().optional(),
});

export type CreateRecurringExpenseRuleInput = z.infer<typeof createRecurringExpenseRuleSchema>;

/** Schedule + dates saved in the UI until the expense is submitted (template comes from the form at save time). */
export type PendingRecurringRuleWithoutTemplate = Omit<CreateRecurringExpenseRuleInput, "template">;

export const updateRecurringExpenseRuleSchema = z
  .object({
    schedule: recurringScheduleSchema.optional(),
    template: recurringExpenseTemplateSchema.optional(),
    startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    maxCount: z.number().int().positive().nullable().optional(),
    status: recurringRuleStatusSchema.optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "At least one field required" });

export type UpdateRecurringExpenseRuleInput = z.infer<typeof updateRecurringExpenseRuleSchema>;
