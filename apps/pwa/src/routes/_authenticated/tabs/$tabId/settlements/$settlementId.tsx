import { createFileRoute } from "@tanstack/react-router";
import { prefetchSettlement } from "@/src/lib/route-loaders";
import { SettlementPage } from "@/app/(app)/tabs/[tabId]/settlements/[settlementId]/page";

export const Route = createFileRoute(
  "/_authenticated/tabs/$tabId/settlements/$settlementId",
)({
  loader: ({ context, params }) =>
    prefetchSettlement(
      context.queryClient,
      params.tabId,
      params.settlementId,
    ),
  component: SettlementPage,
});
