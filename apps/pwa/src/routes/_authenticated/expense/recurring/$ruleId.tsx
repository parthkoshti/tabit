import { createFileRoute } from "@tanstack/react-router";
import { prefetchRecurringExpense } from "@/src/lib/route-loaders";
import { RecurringExpenseRulePage } from "@/app/(app)/expense/recurring/[ruleId]/page";

export const Route = createFileRoute(
  "/_authenticated/expense/recurring/$ruleId",
)({
  loader: ({ context, params }) =>
    prefetchRecurringExpense(context.queryClient, params.ruleId),
  component: RecurringExpenseRulePage,
});
