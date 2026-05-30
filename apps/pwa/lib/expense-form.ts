import { createExpenseSchema } from "models";
import { zodFieldErrors } from "@/lib/form-zod";
import type { SplitConfig } from "@/components/split-dialog";

export function parseExpenseAmount(value: string): number | null {
  const num = parseFloat(value);
  if (isNaN(num) || num < 0.01) return null;
  return num;
}

type ExpenseFormValues = {
  amount: string;
  currency: string;
  description: string;
  expenseDate: Date;
  participantIds: string[];
};

type TabParticipant = {
  id: string;
  userId: string | null;
};

type ExpensePayerSource = {
  paidByParticipantId?: string | null;
  paidById: string | null;
  paidBy: { id: string };
};

export function resolveExpensePayerParticipantId(
  expense: ExpensePayerSource,
  tabParticipants: TabParticipant[],
): string {
  if (tabParticipants.length === 0) return "";

  const isValid = (id: string) => tabParticipants.some((p) => p.id === id);

  if (expense.paidByParticipantId && isValid(expense.paidByParticipantId)) {
    return expense.paidByParticipantId;
  }

  if (expense.paidById) {
    const byUserId = tabParticipants.find(
      (p) => p.userId != null && p.userId === expense.paidById,
    )?.id;
    if (byUserId) return byUserId;

    if (isValid(expense.paidById)) return expense.paidById;
  }

  const byPaidByUser = tabParticipants.find(
    (p) => p.userId === expense.paidBy.id || p.id === expense.paidBy.id,
  )?.id;
  if (byPaidByUser) return byPaidByUser;

  return tabParticipants[0]!.id;
}

export function validateExpenseFormValues(
  tabId: string,
  value: ExpenseFormValues,
  paidByParticipantId: string,
  splitConfig: SplitConfig | null,
  tabParticipants: TabParticipant[],
): Record<string, string> | undefined {
  if (!paidByParticipantId.trim()) {
    return { paidByParticipantId: "Select who paid" };
  }

  const parsedAmount = parseExpenseAmount(value.amount);
  if (parsedAmount === null) {
    return { amount: "Please enter a valid amount (min $0.01)" };
  }
  if (!value.description.trim()) {
    return { description: "Please add a description" };
  }
  if (value.participantIds.length < 1) {
    return { participantIds: "At least one person must be in the split" };
  }
  if (
    value.participantIds.length === 1 &&
    value.participantIds[0] === paidByParticipantId
  ) {
    return {
      participantIds: "Payer cannot be the only member of the split",
    };
  }

  const payerParticipant = tabParticipants.find(
    (p) => p.id === paidByParticipantId,
  );
  const payerPayload =
    payerParticipant?.userId != null
      ? { paidById: payerParticipant.userId }
      : { paidByParticipantId };

  const base = {
    tabId,
    amount: parsedAmount,
    currency: value.currency,
    description: value.description.trim(),
    expenseDate: value.expenseDate,
    ...payerPayload,
  };

  const mapPayerZodErrors = (
    errors: Record<string, string> | undefined,
  ): Record<string, string> | undefined => {
    if (!errors?.paidById) return errors;
    const { paidById, ...rest } = errors;
    return { ...rest, paidByParticipantId: paidById };
  };

  if (splitConfig == null || splitConfig.splitType === "equal") {
    return mapPayerZodErrors(
      zodFieldErrors(createExpenseSchema, {
        ...base,
        splitType: "equal" as const,
      }),
    );
  }

  if (splitConfig.splitType === "custom") {
    return mapPayerZodErrors(
      zodFieldErrors(createExpenseSchema, {
        ...base,
        splitType: "custom" as const,
        splits: splitConfig.splits,
      }),
    );
  }

  return mapPayerZodErrors(
    zodFieldErrors(createExpenseSchema, {
      ...base,
      splitType: splitConfig.splitType,
      splits: splitConfig.splits.map((s) => ({
        userId: s.userId,
        weight: s.weight,
      })),
    }),
  );
}

export function buildExpenseCreateBody(
  value: ExpenseFormValues,
  paidByParticipantId: string,
  splitConfig: SplitConfig | null,
  tabParticipants: TabParticipant[],
) {
  const parsedAmount = parseExpenseAmount(value.amount)!;
  const participantIdsList = value.participantIds;
  const payerParticipant = tabParticipants.find(
    (p) => p.id === paidByParticipantId,
  );
  const payerPayload =
    payerParticipant?.userId != null
      ? { paidById: payerParticipant.userId }
      : { paidByParticipantId };

  if (splitConfig == null || splitConfig.splitType === "equal") {
    return {
      amount: parsedAmount,
      currency: value.currency,
      description: value.description.trim(),
      ...payerPayload,
      splitType: "equal" as const,
      participantIds: participantIdsList,
      expenseDate: value.expenseDate.toISOString(),
    };
  }

  if (splitConfig.splitType === "custom") {
    return {
      amount: parsedAmount,
      currency: value.currency,
      description: value.description.trim(),
      ...payerPayload,
      splitType: "custom" as const,
      participantIds: participantIdsList,
      splits: splitConfig.splits,
      expenseDate: value.expenseDate.toISOString(),
    };
  }

  return {
    amount: parsedAmount,
    currency: value.currency,
    description: value.description.trim(),
    ...payerPayload,
    splitType: splitConfig.splitType,
    participantIds: participantIdsList,
    splits: splitConfig.splits.map((s) => ({
      userId: s.userId,
      weight: s.weight,
    })),
    expenseDate: value.expenseDate.toISOString(),
  };
}

export function buildExpenseUpdateBody(
  value: ExpenseFormValues,
  paidByParticipantId: string,
  splitConfig: SplitConfig | null,
) {
  const parsedAmount = parseExpenseAmount(value.amount)!;
  const participantIdsList = value.participantIds;

  if (splitConfig == null || splitConfig.splitType === "equal") {
    return {
      amount: parsedAmount,
      currency: value.currency,
      description: value.description.trim(),
      paidByParticipantId,
      splitType: "equal" as const,
      expenseDate: value.expenseDate.toISOString().slice(0, 10),
      participantIds: participantIdsList,
    };
  }

  if (splitConfig.splitType === "custom") {
    return {
      amount: parsedAmount,
      currency: value.currency,
      description: value.description.trim(),
      paidByParticipantId,
      splitType: "custom" as const,
      expenseDate: value.expenseDate.toISOString().slice(0, 10),
      participantIds: participantIdsList,
      splits: splitConfig.splits,
    };
  }

  return {
    amount: parsedAmount,
    currency: value.currency,
    description: value.description.trim(),
    paidByParticipantId,
    splitType: splitConfig.splitType,
    expenseDate: value.expenseDate.toISOString().slice(0, 10),
    participantIds: participantIdsList,
    splits: splitConfig.splits.map((s) => ({
      userId: s.userId,
      weight: s.weight,
    })),
  };
}
