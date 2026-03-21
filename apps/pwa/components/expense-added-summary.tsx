import { useMemo } from "react";
import { UserAvatar } from "@/components/user-avatar";
import { ReceiptText } from "lucide-react";
import { formatAmount } from "@/lib/format-amount";

export type ExpenseAddedParticipant = {
  userId: string;
  name: string | null;
  paid?: number;
  owes?: number;
};

export function ExpenseAddedSummary({
  amount,
  description,
  tabName,
  currency = "USD",
  participants,
  currentUserId,
}: {
  amount: number;
  description: string;
  tabName: string;
  currency?: string;
  participants: ExpenseAddedParticipant[];
  currentUserId: string;
}) {
  const sortedParticipants = useMemo(
    () =>
      [...participants].sort((a, b) => {
        const aPaid = a.paid != null && a.paid > 0 ? 1 : 0;
        const bPaid = b.paid != null && b.paid > 0 ? 1 : 0;
        if (bPaid !== aPaid) return bPaid - aPaid;
        const aName = (
          a.userId === currentUserId ? "You" : (a.name ?? "Unknown")
        ).toLowerCase();
        const bName = (
          b.userId === currentUserId ? "You" : (b.name ?? "Unknown")
        ).toLowerCase();
        return aName.localeCompare(bName);
      }),
    [participants, currentUserId],
  );

  return (
    <div className="space-y-3">
      <p className="flex flex-wrap items-end gap-x-1.5 gap-y-0.5 text- text-muted-foreground">
        <span className="text-foreground wrap-break-word font-medium">
          {formatAmount(amount, currency)}
        </span>
        <span>for</span>
        <span className="text-foreground wrap-break-word">{description}</span>
        <span>to</span>
        <span className="inline-flex items-center gap-1 text-foreground wrap-break-word">
          <ReceiptText className="h-3.5 w-3.5 shrink-0 text-tab-icon" />
          {tabName}
        </span>
      </p>
      {participants.length > 0 ? (
        <ul className="space-y-1.5 text-xs text-muted-foreground">
          {sortedParticipants.map((p) => (
            <li key={p.userId} className="flex min-w-0 items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <UserAvatar userId={p.userId} size="xs" />
                <span className="wrap-break-word">
                  {p.userId === currentUserId ? "You" : (p.name ?? "Unknown")}
                </span>
              </div>
              {p.paid != null && p.paid > 0 ? (
                <span className="shrink-0 text-right text-positive tabular-nums">
                  Paid {formatAmount(p.paid, currency)}
                </span>
              ) : p.owes != null && p.owes > 0 ? (
                <span className="shrink-0 text-right text-destructive tabular-nums">
                  {p.userId === currentUserId || p.name === "You"
                    ? "Owe"
                    : "Owes"}{" "}
                  {formatAmount(p.owes, currency)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
