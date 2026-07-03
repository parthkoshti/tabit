import { getDisplayName } from "@/lib/display-name";
import {
  expenseToBucketKey,
  formatBucketLabel,
  getChartGranularity,
  isExpenseInRange,
  listBucketKeys,
  type TabExpensesChartRange,
} from "@/lib/tab-expenses-chart-range";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

export type TabExpensesChartPayer = {
  key: string;
  label: string;
  color: string;
};

export type TabExpensesChartPoint = {
  label: string;
  bucketKey: string;
  [payerKey: string]: string | number;
};

type TabParticipant = {
  id: string;
  displayName?: string | null;
  userId?: string | null;
};

type MemberUser = {
  id?: string;
  name?: string | null;
  username?: string | null;
  email?: string | null;
};

function sanitizePayerKey(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_]/g, "_");
}

type ChartExpense = {
  deletedAt: Date | string | null;
  paidById: string | null;
  paidByParticipantId: string | null;
  amount: number;
  expenseDate: Date | string;
  paidBy?: {
    id: string;
    email?: string;
    name?: string | null;
    username?: string | null;
  };
};

function getExpensePayerKey(expense: ChartExpense): string {
  if (expense.paidById) return sanitizePayerKey(`user_${expense.paidById}`);
  if (expense.paidByParticipantId) {
    return sanitizePayerKey(`participant_${expense.paidByParticipantId}`);
  }
  return "unknown";
}

function getExpensePayerLabel(
  expense: ChartExpense,
  currentUserId: string,
  getMemberUser: (userId: string) => MemberUser,
  participants?: TabParticipant[],
): string {
  if (expense.paidById) {
    return getDisplayName(getMemberUser(expense.paidById), currentUserId);
  }
  if (expense.paidByParticipantId) {
    const participant = participants?.find(
      (p) => p.id === expense.paidByParticipantId,
    );
    if (participant?.userId) {
      return getDisplayName(getMemberUser(participant.userId), currentUserId);
    }
    if (participant?.displayName?.trim()) return participant.displayName.trim();
  }
  if (expense.paidBy) {
    return getDisplayName(expense.paidBy, currentUserId);
  }
  return "Unknown";
}

export function buildTabExpensesChartData(
  expenses: ChartExpense[],
  currentUserId: string,
  getMemberUser: (userId: string) => MemberUser,
  participants: TabParticipant[] | undefined,
  range: TabExpensesChartRange,
  now = new Date(),
): { data: TabExpensesChartPoint[]; payers: TabExpensesChartPayer[] } {
  const granularity = getChartGranularity(range);
  const activeExpenses = expenses.filter(
    (expense) =>
      !expense.deletedAt && isExpenseInRange(expense.expenseDate, range, now),
  );

  if (activeExpenses.length === 0) {
    return { data: [], payers: [] };
  }

  const payerMeta = new Map<string, TabExpensesChartPayer>();
  const buckets = new Map<string, Map<string, number>>();

  for (const expense of activeExpenses) {
    const payerKey = getExpensePayerKey(expense);
    if (!payerMeta.has(payerKey)) {
      payerMeta.set(payerKey, {
        key: payerKey,
        label: getExpensePayerLabel(
          expense,
          currentUserId,
          getMemberUser,
          participants,
        ),
        color: CHART_COLORS[payerMeta.size % CHART_COLORS.length],
      });
    }

    const bucketKey = expenseToBucketKey(expense.expenseDate, granularity);
    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, new Map());
    }
    const bucket = buckets.get(bucketKey)!;
    bucket.set(payerKey, (bucket.get(payerKey) ?? 0) + expense.amount);
  }

  const payers = [...payerMeta.values()];
  const fixedBucketKeys = listBucketKeys(range, now);
  const sortedBucketKeys =
    fixedBucketKeys.length > 0
      ? fixedBucketKeys
      : [...buckets.keys()].sort();

  const data = sortedBucketKeys.map((bucketKey) => {
    const bucket = buckets.get(bucketKey) ?? new Map<string, number>();
    const point: TabExpensesChartPoint = {
      label: formatBucketLabel(bucketKey, granularity, range),
      bucketKey,
    };
    for (const payer of payers) {
      point[payer.key] = bucket.get(payer.key) ?? 0;
    }
    return point;
  });

  return { data, payers };
}

export type TabExpensesDonutPoint = {
  payerKey: string;
  label: string;
  amount: number;
  fill: string;
};

export function buildTabExpensesDonutData(
  chartData: TabExpensesChartPoint[],
  payers: TabExpensesChartPayer[],
): TabExpensesDonutPoint[] {
  return payers
    .map((payer) => ({
      payerKey: payer.key,
      label: payer.label,
      amount: chartData.reduce(
        (sum, point) => sum + (Number(point[payer.key]) || 0),
        0,
      ),
      fill: `var(--color-${payer.key})`,
    }))
    .filter((point) => point.amount > 0);
}
