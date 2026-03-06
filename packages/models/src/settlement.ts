import { z } from "zod";

export const recordSettlementSchema = z.object({
  groupId: z.string(),
  fromUserId: z.string(),
  toUserId: z.string(),
  amount: z.number().positive(),
});

export type RecordSettlementInput = z.infer<typeof recordSettlementSchema>;

export const settlementSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  fromUserId: z.string(),
  toUserId: z.string(),
  amount: z.number(),
  createdAt: z.date(),
});

export type Settlement = z.infer<typeof settlementSchema>;

export const balanceSchema = z.object({
  userId: z.string(),
  amount: z.number(),
  user: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string().nullable(),
  }),
});

export type Balance = z.infer<typeof balanceSchema>;
