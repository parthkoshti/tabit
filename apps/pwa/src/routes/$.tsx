import { createFileRoute } from "@tanstack/react-router";
import { NotFoundPage } from "@/app/not-found";

export const Route = createFileRoute("/$")({
  component: NotFoundPage,
});
