import { createFileRoute } from "@tanstack/react-router";
import { prefetchTab } from "@/src/lib/route-loaders";
import { TabMembersPage } from "@/app/(app)/tabs/[tabId]/members/page";

export const Route = createFileRoute("/_authenticated/tabs/$tabId/members")({
  loader: ({ context, params }) =>
    prefetchTab(context.queryClient, params.tabId),
  component: TabMembersPage,
});
