import { createFileRoute } from "@tanstack/react-router";
import { InvitePage } from "@/app/invite/page";

export const Route = createFileRoute("/invite")({
  component: InvitePage,
});
