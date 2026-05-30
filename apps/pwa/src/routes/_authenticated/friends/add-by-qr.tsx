import { createFileRoute } from "@tanstack/react-router";
import { AddByQrPage } from "@/app/(app)/friends/add-by-qr/page";

export const Route = createFileRoute("/_authenticated/friends/add-by-qr")({
  component: AddByQrPage,
});
