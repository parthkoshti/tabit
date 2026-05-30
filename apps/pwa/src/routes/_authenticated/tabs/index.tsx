import { createFileRoute } from "@tanstack/react-router";
import { TabsPage } from "@/app/(app)/tabs/page";
import { prefetchTabs } from "@/src/lib/route-loaders";

export const Route = createFileRoute("/_authenticated/tabs/")({
  loader: ({ context }) => prefetchTabs(context.queryClient),
  component: TabsPage,
});
