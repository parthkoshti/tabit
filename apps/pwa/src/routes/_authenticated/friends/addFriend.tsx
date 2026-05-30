import { createFileRoute } from "@tanstack/react-router";
import { AddFriendPage } from "@/app/(app)/friends/addFriend/page";

export const Route = createFileRoute("/_authenticated/friends/addFriend")({
  component: AddFriendPage,
});
