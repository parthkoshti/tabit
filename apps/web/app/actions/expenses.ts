"use server";

import { db, expense, expenseSplit, tabMember } from "db";
import { createExpenseSchema } from "models";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

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

  const members = await db
    .select()
    .from(tabMember)
    .where(eq(tabMember.tabId, parsed.data.tabId));

  const expenseId = nanoid();
  const amount = parsed.data.amount;

  let splits: { userId: string; amount: number }[];

  if (parsed.data.splitType === "equal") {
    const perPerson = amount / members.length;
    splits = members.map((m) => ({ userId: m.userId, amount: perPerson }));
  } else if (parsed.data.splits && parsed.data.splits.length > 0) {
    splits = parsed.data.splits;
  } else {
    return { success: false, error: "Custom split requires splits array" };
  }

  await db.insert(expense).values({
    id: expenseId,
    tabId: parsed.data.tabId,
    paidById: parsed.data.paidById,
    amount: parsed.data.amount.toString(),
    description: parsed.data.description,
    splitType: parsed.data.splitType,
  });

  for (const s of splits) {
    await db.insert(expenseSplit).values({
      id: nanoid(),
      expenseId,
      userId: s.userId,
      amount: s.amount.toString(),
    });
  }

  return { success: true, expenseId };
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

  await db.delete(expenseSplit).where(eq(expenseSplit.expenseId, expenseId));
  await db.delete(expense).where(eq(expense.id, expenseId));

  return { success: true };
}
