"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { Pencil, ReceiptText } from "lucide-react";

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
  participants,
  currentUserId,
}: {
  expenseId: string;
  tabId: string;
  amount: number;
  description: string;
  tabName: string;
  participants: Participant[];
  currentUserId: string;
}) {
  const router = useRouter();

  return (
    <div className="flex min-w-0 items-center justify-between gap-4">
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="font-medium">Expense added</p>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <span className="text-foreground">${amount.toFixed(2)}</span> for{" "}
          <span className="text-foreground">{description}</span> to{" "}
          <span className="inline-flex items-center gap-1 text-foreground">
            <ReceiptText className="h-3.5 w-3.5 shrink-0 text-tab-icon" />
            {tabName}
          </span>
        </p>
        {participants.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {participants.map((p) => (
              <span
                key={p.userId}
                className="inline-flex items-center gap-1 rounded-full bg-muted/60 py-0.5 pl-0.5 pr-1.5 text-xs text-muted-foreground"
              >
                <UserAvatar userId={p.userId} size="xs" />
                <span>
                  {p.userId === currentUserId ? "You" : p.name ?? "Unknown"}
                </span>
                {p.paid != null && p.paid > 0 ? (
                  <span className="text-positive">
                    Paid ${p.paid.toFixed(2)}
                  </span>
                ) : p.owes != null && p.owes > 0 ? (
                  <span className="text-destructive">
                    {p.userId === currentUserId || p.name === "You"
                      ? "Owe"
                      : "Owes"}{" "}
                    ${p.owes.toFixed(2)}
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
          router.push(`/tabs/${tabId}/expenses/${expenseId}?edit=1`);
        }}
      >
        <Pencil className="h-3.5 w-3.5" />
        Edit
      </Button>
    </div>
  );
}
