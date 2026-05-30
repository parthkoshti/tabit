import { createFileRoute } from "@tanstack/react-router";
import { AppPage } from "@/app/(app)/page";

export const Route = createFileRoute("/_authenticated/")({
  component: AppPage,
});
