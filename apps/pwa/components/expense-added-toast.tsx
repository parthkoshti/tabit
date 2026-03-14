import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { Pencil, ReceiptText } from "lucide-react";
import { formatAmount } from "@/lib/format-amount";

type Participant = {
  userId: string;
  name: string | null;
  paid?: number;
  owes?: number;
};

export function ExpenseAddedToast({
  expenseId,
  tabId,
  amount,
  description,
  tabName,
  currency = "USD",
  participants,
  currentUserId,
}: {
  expenseId: string;
  tabId: string;
  amount: number;
  description: string;
  tabName: string;
  currency?: string;
  participants: Participant[];
  currentUserId: string;
}) {
  const navigate = useNavigate();

  const sortedParticipants = useMemo(
    () =>
      [...participants].sort((a, b) => {
        const aPaid = a.paid != null && a.paid > 0 ? 1 : 0;
        const bPaid = b.paid != null && b.paid > 0 ? 1 : 0;
        if (bPaid !== aPaid) return bPaid - aPaid;
        const aName = (a.userId === currentUserId ? "You" : a.name ?? "Unknown").toLowerCase();
        const bName = (b.userId === currentUserId ? "You" : b.name ?? "Unknown").toLowerCase();
        return aName.localeCompare(bName);
      }),
    [participants, currentUserId],
  );

  return (
    <div className="flex min-w-0 items-center justify-between gap-4">
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="font-medium">Expense added</p>
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-muted-foreground">
          <span className="text-foreground wrap-break-word">{formatAmount(amount, currency)}</span>
          <span>for</span>
          <span className="text-foreground wrap-break-word">{description}</span>
          <span>to</span>
          <span className="inline-flex items-center gap-1 text-foreground wrap-break-word">
            <ReceiptText className="h-3.5 w-3.5 shrink-0 text-tab-icon" />
            {tabName}
          </span>
        </p>
        {participants.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {sortedParticipants.map((p) => (
              <span
                key={p.userId}
                className="inline-flex items-center gap-1 rounded-full bg-muted/60 py-0.5 pl-0.5 pr-1.5 text-xs text-muted-foreground wrap-break-word"
              >
                <UserAvatar userId={p.userId} size="xs" />
                <span>
                  {p.userId === currentUserId ? "You" : p.name ?? "Unknown"}
                </span>
                {p.paid != null && p.paid > 0 ? (
                  <span className="text-positive">
                    Paid {formatAmount(p.paid, currency)}
                  </span>
                ) : p.owes != null && p.owes > 0 ? (
                  <span className="text-destructive">
                    {p.userId === currentUserId || p.name === "You"
                      ? "Owe"
                      : "Owes"}{" "}
                    {formatAmount(p.owes, currency)}
                  </span>
                ) : null}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <Button
          variant="default"
          size="sm"
          className="h-7 shrink-0 px-2.5"
          onClick={() => {
            navigate(`/tabs/${tabId}/expenses/${expenseId}?edit=1`);
          }}
        >
        <Pencil className="h-3.5 w-3.5" />
        Edit
      </Button>
    </div>
  );
}
