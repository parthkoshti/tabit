import { Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getDisplayName } from "@/lib/display-name";
import { UserAvatar } from "@/components/user-avatar";
import {
  formatAmount,
  formatAmountWithCurrencyCode,
} from "@/lib/format-amount";
import { formatAppDate } from "@/lib/format-date";
import type { Settlement } from "data";

type TabSettlementCardProps = {
  settlement: Settlement;
  tabCurrency: string;
  currentUserId: string;
};

export function TabSettlementCard({
  settlement: item,
  tabCurrency,
  currentUserId,
}: TabSettlementCardProps) {
  const foreign =
    item.currency &&
    item.currency !== tabCurrency &&
    item.originalAmount != null;

  return (
    <Card className="cursor-pointer hover:bg-muted/50">
      <CardContent className="flex flex-col gap-1 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Wallet className="h-5 w-5 shrink-0 text-positive" />
            <span className="min-w-0 font-medium text-sm">
              {getDisplayName(item.fromUser, currentUserId)} paid{" "}
              {getDisplayName(item.toUser, currentUserId)}
            </span>
          </div>
          <span className="text-foreground text-sm shrink-0 font-medium tabular-nums">
            {formatAmount(item.amount, tabCurrency)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0 mb-0">
            <span className="inline-flex items-center gap-1.5">
              <UserAvatar userId={item.fromUserId} size="xs" />
              {getDisplayName(item.fromUser, currentUserId)}
            </span>
            <span>to</span>
            <span className="inline-flex items-center gap-1.5">
              <UserAvatar userId={item.toUserId} size="xs" />
              {getDisplayName(item.toUser, currentUserId)}
            </span>
            <span>
              · {formatAppDate(item.settlementDate ?? item.createdAt)}
            </span>
          </p>
          {foreign ? (
            <span className="text-sm font-normal text-muted-foreground tabular-nums shrink-0 text-right">
              {formatAmountWithCurrencyCode(
                item.originalAmount!,
                item.currency,
              )}
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
