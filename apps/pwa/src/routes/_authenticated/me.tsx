import { createFileRoute } from "@tanstack/react-router";
import { MePage } from "@/app/(app)/me/page";

export const Route = createFileRoute("/_authenticated/me")({
  component: MePage,
});
