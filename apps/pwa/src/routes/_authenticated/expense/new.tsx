import { createFileRoute } from "@tanstack/react-router";
import { prefetchFriends, prefetchTabs } from "@/src/lib/route-loaders";
import { LogExpensePage } from "@/app/(app)/expense/new/page";

export const Route = createFileRoute("/_authenticated/expense/new")({
  loader: ({ context }) => {
    prefetchTabs(context.queryClient);
    prefetchFriends(context.queryClient);
  },
  component: LogExpensePage,
});
