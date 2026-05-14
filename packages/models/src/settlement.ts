import { z } from "zod";

export const recordSettlementSchema = z
  .object({
    tabId: z.string(),
    fromUserId: z.string().nullable().optional(),
    toUserId: z.string().nullable().optional(),
    fromParticipantId: z.string().optional(),
    toParticipantId: z.string().optional(),
    amount: z.number().positive(),
    currency: z.string().optional(),
    originalAmount: z.number().positive().optional(),
    settlementDate: z.coerce.date().optional(),
  })
  .superRefine((d, ctx) => {
    const byParticipants = !!(d.fromParticipantId && d.toParticipantId);
    const byUsers = d.fromUserId != null && d.toUserId != null && d.fromUserId !== "" && d.toUserId !== "";
    if (!byParticipants && !byUsers) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide fromUserId+toUserId or fromParticipantId+toParticipantId",
        path: [],
      });
    }
  });

export type RecordSettlementInput = z.infer<typeof recordSettlementSchema>;

export const updateSettlementSchema = z
  .object({
    fromUserId: z.string().nullable().optional(),
    toUserId: z.string().nullable().optional(),
    fromParticipantId: z.string().optional(),
    toParticipantId: z.string().optional(),
    amount: z.number().positive(),
    currency: z.string().optional(),
    originalAmount: z.number().positive().optional(),
    settlementDate: z.coerce.date().optional(),
  })
  .superRefine((d, ctx) => {
    const byParticipants = !!(d.fromParticipantId && d.toParticipantId);
    const byUsers = d.fromUserId != null && d.toUserId != null && d.fromUserId !== "" && d.toUserId !== "";
    if (!byParticipants && !byUsers) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide fromUserId+toUserId or fromParticipantId+toParticipantId",
        path: [],
      });
    }
  });

export type UpdateSettlementInput = z.infer<typeof updateSettlementSchema>;

export const settlementSchema = z.object({
  id: z.string(),
  tabId: z.string(),
  fromUserId: z.string().nullable(),
  toUserId: z.string().nullable(),
  fromParticipantId: z.string().nullable().optional(),
  toParticipantId: z.string().nullable().optional(),
  amount: z.number(),
  currency: z.string().nullable().optional(),
  originalAmount: z.number().nullable().optional(),
  settlementDate: z.date(),
  createdAt: z.date(),
});

export type Settlement = z.infer<typeof settlementSchema>;

export const balanceSchema = z.object({
  participantId: z.string(),
  userId: z.string().nullable(),
  kind: z.string(),
  displayName: z.string(),
  amount: z.number(),
  user: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string().nullable(),
    username: z.string().nullable().optional(),
  }),
});

export type Balance = z.infer<typeof balanceSchema>;
