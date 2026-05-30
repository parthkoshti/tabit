import { createFileRoute } from "@tanstack/react-router";
import { prefetchExpense } from "@/src/lib/route-loaders";
import { ExpensePage } from "@/app/(app)/tabs/[tabId]/expenses/[expenseId]/page";

export const Route = createFileRoute(
  "/_authenticated/tabs/$tabId/expenses/$expenseId",
)({
  loader: ({ context, params }) =>
    prefetchExpense(context.queryClient, params.tabId, params.expenseId),
  component: ExpensePage,
});
