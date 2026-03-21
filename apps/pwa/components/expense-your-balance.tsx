import { formatAmount } from "@/lib/format-amount";
import { cn } from "@/lib/utils";

/** Bottom-right "You owe" / "You're owed" for expense cards; null if viewer has no split. */
export function ExpenseYourBalance({
  expenseAmount,
  tabCurrency,
  paidById,
  currentUserId,
  yourShare,
  deleted,
}: {
  expenseAmount: number;
  tabCurrency: string;
  paidById: string;
  currentUserId: string;
  yourShare: number | null;
  deleted?: boolean;
}) {
  const youPaid = paidById === currentUserId;
  if (yourShare == null) {
    if (!youPaid || expenseAmount <= 0) return null;
    const muted = !!deleted;
    return (
      <div className="flex shrink-0 text-xs items-end gap-1 text-right">
        <span className="text-muted-foreground">You&apos;re owed</span>
        <span
          className={cn(
            "font-semibold",
            muted && "text-muted-foreground",
            !muted && "text-positive",
          )}
        >
          {formatAmount(expenseAmount, tabCurrency)}
        </span>
      </div>
    );
  }
  const muted = !!deleted;
  const value = youPaid ? expenseAmount - yourShare : yourShare;
  return (
    <div className="flex shrink-0 text-xs items-end gap-1 text-right">
      <span className="text-muted-foreground">
        {youPaid ? "You're owed" : "You owe"}
      </span>
      <span
        className={cn(
          "font-semibold",
          muted && "text-muted-foreground",
          !muted && youPaid && "text-positive",
          !muted && !youPaid && "text-negative",
        )}
      >
        {formatAmount(value, tabCurrency)}
      </span>
    </div>
  );
}
