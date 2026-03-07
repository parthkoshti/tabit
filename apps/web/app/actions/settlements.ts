"use server";

import { db, settlement, settlementAuditLog, tabMember } from "db";
import { recordSettlementSchema } from "models";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";

export async function recordSettlement(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = recordSettlementSchema.safeParse({
    tabId: formData.get("tabId"),
    fromUserId: formData.get("fromUserId"),
    toUserId: formData.get("toUserId"),
    amount: Number(formData.get("amount")),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().formErrors[0] };
  }

  const [member] = await db
    .select()
    .from(tabMember)
    .where(
      and(
        eq(tabMember.tabId, parsed.data.tabId),
        eq(tabMember.userId, session.user.id)
      )
    )
    .limit(1);

  if (!member) {
    return { success: false, error: "You are not a member of this tab" };
  }

  const [fromIsMember] = await db
    .select()
    .from(tabMember)
    .where(
      and(
        eq(tabMember.tabId, parsed.data.tabId),
        eq(tabMember.userId, parsed.data.fromUserId)
      )
    )
    .limit(1);

  const [toIsMember] = await db
    .select()
    .from(tabMember)
    .where(
      and(
        eq(tabMember.tabId, parsed.data.tabId),
        eq(tabMember.userId, parsed.data.toUserId)
      )
    )
    .limit(1);

  if (!fromIsMember || !toIsMember) {
    return { success: false, error: "Both payer and payee must be tab members" };
  }

  if (parsed.data.fromUserId === parsed.data.toUserId) {
    return { success: false, error: "Payer and payee must be different people" };
  }

  const [inserted] = await db
    .insert(settlement)
    .values({
      tabId: parsed.data.tabId,
      fromUserId: parsed.data.fromUserId,
      toUserId: parsed.data.toUserId,
      amount: parsed.data.amount.toString(),
    })
    .returning({ id: settlement.id });
  const settlementId = inserted!.id;

  await db.insert(settlementAuditLog).values({
    settlementId,
    tabId: parsed.data.tabId,
    action: "create",
    performedById: session.user.id,
  });

  return { success: true };
}
