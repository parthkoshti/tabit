import { createFileRoute } from "@tanstack/react-router";
import { prefetchTab } from "@/src/lib/route-loaders";
import { TabPage } from "@/app/(app)/tabs/[tabId]/page";

export const Route = createFileRoute("/_authenticated/tabs/$tabId/")({
  loader: ({ context, params }) =>
    prefetchTab(context.queryClient, params.tabId),
  component: TabPage,
});
