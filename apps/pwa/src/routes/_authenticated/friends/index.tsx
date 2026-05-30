import { createFileRoute } from "@tanstack/react-router";
import { FriendsPage } from "@/app/(app)/friends/page";
import { prefetchFriends } from "@/src/lib/route-loaders";

export const Route = createFileRoute("/_authenticated/friends/")({
  loader: ({ context }) => prefetchFriends(context.queryClient),
  component: FriendsPage,
});
