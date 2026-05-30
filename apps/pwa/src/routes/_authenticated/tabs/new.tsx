import { createFileRoute } from "@tanstack/react-router";
import { CreateTabPage } from "@/app/(app)/tabs/new/page";

export const Route = createFileRoute("/_authenticated/tabs/new")({
  component: CreateTabPage,
});
