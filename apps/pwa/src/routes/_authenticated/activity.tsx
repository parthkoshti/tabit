import { createFileRoute } from "@tanstack/react-router";
import { ActivityPage } from "@/app/(app)/activity/page";
import { prefetchActivity } from "@/src/lib/route-loaders";

export const Route = createFileRoute("/_authenticated/activity")({
  loader: ({ context }) => prefetchActivity(context.queryClient),
  component: ActivityPage,
});
