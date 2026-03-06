"use server";

import { db, settlement, groupMember } from "db";
import { recordSettlementSchema } from "models";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

export async function recordSettlement(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = recordSettlementSchema.safeParse({
    groupId: formData.get("groupId"),
    fromUserId: formData.get("fromUserId"),
    toUserId: formData.get("toUserId"),
    amount: Number(formData.get("amount")),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().formErrors[0] };
  }

  if (parsed.data.fromUserId !== session.user.id) {
    return { success: false, error: "You can only record settlements you pay" };
  }

  const [member] = await db
    .select()
    .from(groupMember)
    .where(
      and(
        eq(groupMember.groupId, parsed.data.groupId),
        eq(groupMember.userId, session.user.id)
      )
    )
    .limit(1);

  if (!member) {
    return { success: false, error: "You are not a member of this group" };
  }

  await db.insert(settlement).values({
    id: nanoid(),
    groupId: parsed.data.groupId,
    fromUserId: parsed.data.fromUserId,
    toUserId: parsed.data.toUserId,
    amount: parsed.data.amount.toString(),
  });

  return { success: true };
}
