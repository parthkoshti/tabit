"use server";

import { db, expense, expenseAuditLog, expenseSplit, tabMember } from "db";

function roundTo2(n: number) {
  return Math.round(n * 100) / 100;
}
import { createExpenseSchema } from "models";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";

export async function createExpense(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = createExpenseSchema.safeParse({
    tabId: formData.get("tabId"),
    amount: Number(formData.get("amount")),
    description: formData.get("description"),
    paidById: formData.get("paidById") ?? session.user.id,
    splitType: formData.get("splitType") ?? "equal",
    expenseDate: formData.get("expenseDate") || undefined,
    splits: formData.get("splits")
      ? JSON.parse(formData.get("splits") as string)
      : undefined,
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

  const [payerIsMember] = await db
    .select()
    .from(tabMember)
    .where(
      and(
        eq(tabMember.tabId, parsed.data.tabId),
        eq(tabMember.userId, parsed.data.paidById)
      )
    )
    .limit(1);

  if (!payerIsMember) {
    return { success: false, error: "Payer must be a member of this tab" };
  }

  const allMembers = await db
    .select()
    .from(tabMember)
    .where(eq(tabMember.tabId, parsed.data.tabId));

  const participantIdsRaw = formData.get("participantIds");
  const participantIds = participantIdsRaw
    ? (JSON.parse(participantIdsRaw as string) as string[])
    : allMembers.map((m) => m.userId);

  const members = participantIds.length > 0
    ? allMembers.filter((m) => participantIds.includes(m.userId))
    : allMembers;

  if (members.length < 2) {
    return { success: false, error: "Add at least one other person to split with" };
  }

  const amount = parsed.data.amount;

  let splits: { userId: string; amount: number }[];

  if (parsed.data.splitType === "equal") {
    const perPerson = Math.floor((amount / members.length) * 100) / 100;
    const remainder = roundTo2(
      amount - perPerson * (members.length - 1),
    );
    splits = members.map((m, i) => ({
      userId: m.userId,
      amount: i === members.length - 1 ? remainder : perPerson,
    }));
  } else if (parsed.data.splits && parsed.data.splits.length > 0) {
    splits = parsed.data.splits.map((s) => ({
      userId: s.userId,
      amount: roundTo2(s.amount),
    }));
  } else {
    return { success: false, error: "Custom split requires splits array" };
  }

  const [inserted] = await db
    .insert(expense)
    .values({
      tabId: parsed.data.tabId,
      paidById: parsed.data.paidById,
      amount: parsed.data.amount.toString(),
      description: parsed.data.description,
      splitType: parsed.data.splitType,
      expenseDate: parsed.data.expenseDate,
    })
    .returning({ id: expense.id });
  const expenseId = inserted!.id;

  for (const s of splits) {
    await db.insert(expenseSplit).values({
      expenseId,
      userId: s.userId,
      amount: s.amount.toString(),
    });
  }

  await db.insert(expenseAuditLog).values({
    expenseId,
    tabId: parsed.data.tabId,
    action: "create",
    performedById: session.user.id,
    changes: null,
  });

  return { success: true, expenseId };
}

export async function updateExpense(expenseId: string, formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  const [existing] = await db
    .select()
    .from(expense)
    .where(eq(expense.id, expenseId))
    .limit(1);

  if (!existing) {
    return { success: false, error: "Expense not found" };
  }

  const [member] = await db
    .select()
    .from(tabMember)
    .where(
      and(
        eq(tabMember.tabId, existing.tabId),
        eq(tabMember.userId, session.user.id)
      )
    )
    .limit(1);

  if (!member) {
    return { success: false, error: "You are not a member of this tab" };
  }

  const parsed = createExpenseSchema.safeParse({
    tabId: existing.tabId,
    amount: Number(formData.get("amount")),
    description: formData.get("description"),
    paidById: formData.get("paidById") ?? session.user.id,
    splitType: formData.get("splitType") ?? "equal",
    expenseDate: formData.get("expenseDate") || undefined,
    splits: formData.get("splits")
      ? JSON.parse(formData.get("splits") as string)
      : undefined,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().formErrors[0] ?? "Invalid input" };
  }

  const [payerIsMember] = await db
    .select()
    .from(tabMember)
    .where(
      and(
        eq(tabMember.tabId, existing.tabId),
        eq(tabMember.userId, parsed.data.paidById)
      )
    )
    .limit(1);

  if (!payerIsMember) {
    return { success: false, error: "Payer must be a member of this tab" };
  }

  const allMembers = await db
    .select()
    .from(tabMember)
    .where(eq(tabMember.tabId, existing.tabId));

  const participantIdsRaw = formData.get("participantIds");
  const participantIds = participantIdsRaw
    ? (JSON.parse(participantIdsRaw as string) as string[])
    : allMembers.map((m) => m.userId);

  const members = participantIds.length > 0
    ? allMembers.filter((m) => participantIds.includes(m.userId))
    : allMembers;

  if (members.length < 2) {
    return { success: false, error: "Add at least one other person to split with" };
  }

  const amount = parsed.data.amount;
  let splits: { userId: string; amount: number }[];

  if (parsed.data.splitType === "equal") {
    const perPerson = Math.floor((amount / members.length) * 100) / 100;
    const remainder = roundTo2(
      amount - perPerson * (members.length - 1),
    );
    splits = members.map((m, i) => ({
      userId: m.userId,
      amount: i === members.length - 1 ? remainder : perPerson,
    }));
  } else if (parsed.data.splits && parsed.data.splits.length > 0) {
    splits = parsed.data.splits.map((s) => ({
      userId: s.userId,
      amount: roundTo2(s.amount),
    }));
  } else {
    return { success: false, error: "Custom split requires splits array" };
  }

  const existingSplits = await db
    .select()
    .from(expenseSplit)
    .where(eq(expenseSplit.expenseId, expenseId));

  const changes: Record<string, { from: unknown; to: unknown }> = {};
  const existingDateStr = new Date(existing.expenseDate).toISOString().slice(0, 10);
  const newDateStr = parsed.data.expenseDate.toISOString().slice(0, 10);
  if (existingDateStr !== newDateStr) {
    changes.expenseDate = {
      from: existing.expenseDate,
      to: parsed.data.expenseDate,
    };
  }
  if (Number(existing.amount) !== parsed.data.amount) {
    changes.amount = { from: Number(existing.amount), to: parsed.data.amount };
  }
  if (existing.description !== parsed.data.description) {
    changes.description = { from: existing.description, to: parsed.data.description };
  }
  if (existing.paidById !== parsed.data.paidById) {
    changes.paidById = { from: existing.paidById, to: parsed.data.paidById };
  }
  const oldParticipantIds = [...existingSplits.map((s) => s.userId)].sort();
  const newParticipantIds = [...participantIds].sort();
  if (
    oldParticipantIds.length !== newParticipantIds.length ||
    oldParticipantIds.some((id, i) => id !== newParticipantIds[i])
  ) {
    changes.participants = {
      from: oldParticipantIds,
      to: newParticipantIds,
    };
  }
  const oldSplitsMap = Object.fromEntries(
    existingSplits.map((s) => [s.userId, roundTo2(Number(s.amount))]),
  );
  const newSplitsMap = Object.fromEntries(
    splits.map((s) => [s.userId, roundTo2(s.amount)]),
  );
  const splitsChanged =
    JSON.stringify(oldSplitsMap) !== JSON.stringify(newSplitsMap);
  if (splitsChanged && !changes.participants) {
    changes.splits = { from: oldSplitsMap, to: newSplitsMap };
  }

  await db
    .update(expense)
    .set({
      paidById: parsed.data.paidById,
      amount: parsed.data.amount.toString(),
      description: parsed.data.description,
      splitType: parsed.data.splitType,
      expenseDate: parsed.data.expenseDate,
    })
    .where(eq(expense.id, expenseId));

  await db.delete(expenseSplit).where(eq(expenseSplit.expenseId, expenseId));

  for (const s of splits) {
    await db.insert(expenseSplit).values({
      expenseId,
      userId: s.userId,
      amount: s.amount.toString(),
    });
  }

  if (Object.keys(changes).length > 0) {
    await db.insert(expenseAuditLog).values({
      expenseId,
      tabId: existing.tabId,
      action: "update",
      performedById: session.user.id,
      changes: changes as unknown as Record<string, unknown>,
    });
  }

  return { success: true };
}

export async function deleteExpense(expenseId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  const [exp] = await db
    .select()
    .from(expense)
    .where(eq(expense.id, expenseId))
    .limit(1);

  if (!exp) {
    return { success: false, error: "Expense not found" };
  }

  const [member] = await db
    .select()
    .from(tabMember)
    .where(
      and(
        eq(tabMember.tabId, exp.tabId),
        eq(tabMember.userId, session.user.id)
      )
    )
    .limit(1);

  if (!member) {
    return { success: false, error: "You are not a member of this tab" };
  }

  await db.insert(expenseAuditLog).values({
    expenseId,
    tabId: exp.tabId,
    action: "delete",
    performedById: session.user.id,
    changes: null,
  });

  await db.delete(expenseSplit).where(eq(expenseSplit.expenseId, expenseId));
  await db.delete(expense).where(eq(expense.id, expenseId));

  return { success: true };
}
