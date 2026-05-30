import { createFileRoute } from "@tanstack/react-router";
import { prefetchTab } from "@/src/lib/route-loaders";
import { TabManagePage } from "@/app/(app)/tabs/[tabId]/manage/page";

export const Route = createFileRoute("/_authenticated/tabs/$tabId/manage")({
  loader: ({ context, params }) =>
    prefetchTab(context.queryClient, params.tabId),
  component: TabManagePage,
});
