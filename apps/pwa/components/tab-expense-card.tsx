import { BanknoteArrowUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getDisplayName } from "@/lib/display-name";
import { UserAvatar } from "@/components/user-avatar";
import {
  formatAmount,
  formatAmountWithCurrencyCode,
} from "@/lib/format-amount";
import { formatAppDate } from "@/lib/format-date";
import { ExpenseReactions } from "@/components/expense-reactions";
import { ExpenseYourBalance } from "@/components/expense-your-balance";
import type { Expense } from "data";

export type TabMemberUser = {
  id: string;
  email?: string;
  name?: string | null;
  username?: string | null;
};

type TabExpenseCardProps = {
  expense: Expense;
  tabCurrency: string;
  tabId: string;
  isDirect: boolean;
  currentUserId: string;
  getMemberUser: (userId: string) => TabMemberUser;
};

export function TabExpenseCard({
  expense: item,
  tabCurrency,
  tabId,
  isDirect,
  currentUserId,
  getMemberUser,
}: TabExpenseCardProps) {
  return (
    <Card
      className={`cursor-pointer hover:bg-muted/50 ${
        item.deletedAt ? "opacity-60" : ""
      }`}
    >
      <CardContent className="flex flex-col gap-1 p-4">
        {!isDirect ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <BanknoteArrowUp
                  className={`h-5 w-5 shrink-0 ${
                    item.deletedAt
                      ? "text-muted-foreground"
                      : "text-negative"
                  }`}
                />
                <span
                  className={`min-w-0 flex-1 font-medium text-sm ${
                    item.deletedAt ? "text-muted-foreground" : ""
                  }`}
                >
                  {item.description}
                </span>
                {item.deletedAt && (
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    Deleted
                  </span>
                )}
              </div>
              <span
                className={`text-sm shrink-0 font-medium tabular-nums ${
                  item.deletedAt
                    ? "text-muted-foreground"
                    : "text-foreground"
                }`}
              >
                {formatAmount(item.amount, tabCurrency)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 mb-0 min-w-0">
                Paid by{" "}
                <span className="inline-flex items-center gap-1.5">
                  <UserAvatar userId={item.paidById} size="xs" />
                  {getDisplayName(getMemberUser(item.paidById), currentUserId)}
                </span>
              </p>
              {item.currency !== tabCurrency ? (
                <span className="text-sm font-normal text-muted-foreground tabular-nums shrink-0 text-right">
                  {formatAmountWithCurrencyCode(
                    item.originalAmount,
                    item.currency,
                  )}
                </span>
              ) : null}
            </div>
            <div className="flex items-end justify-between gap-3 pt-0.5">
              <p className="text-xs text-muted-foreground min-w-0">
                {formatAppDate(item.expenseDate)}
              </p>
              <div className="flex items-center gap-2">
                <ExpenseYourBalance
                  expenseAmount={item.amount}
                  tabCurrency={tabCurrency}
                  paidById={item.paidById}
                  currentUserId={currentUserId}
                  yourShare={
                    item.splits.find((s) => s.userId === currentUserId)
                      ?.amount ?? null
                  }
                  deleted={!!item.deletedAt}
                />
                {!item.deletedAt && (
                  <ExpenseReactions
                    expenseId={item.id}
                    tabId={tabId}
                    reactions={item.reactions ?? []}
                    currentUserId={currentUserId}
                    compact
                    getDisplayName={(userId) =>
                      getDisplayName(getMemberUser(userId), currentUserId)
                    }
                  />
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <BanknoteArrowUp
                  className={`h-5 w-5 shrink-0 ${
                    item.deletedAt
                      ? "text-muted-foreground"
                      : "text-negative"
                  }`}
                />
                <span
                  className={`min-w-0 flex-1 font-medium text-sm ${
                    item.deletedAt ? "text-muted-foreground" : ""
                  }`}
                >
                  {item.description}
                </span>
                {item.deletedAt && (
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    Deleted
                  </span>
                )}
              </div>
              <span
                className={`text-sm shrink-0 font-medium ${
                  item.deletedAt
                    ? "text-muted-foreground"
                    : "text-foreground"
                }`}
              >
                {formatAmount(item.amount, tabCurrency)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                Paid by{" "}
                <span className="inline-flex items-center gap-1.5">
                  <UserAvatar userId={item.paidById} size="xs" />
                  {getDisplayName(getMemberUser(item.paidById), currentUserId)}
                </span>
                <span>· {formatAppDate(item.expenseDate)}</span>
              </p>
              {item.currency !== tabCurrency ? (
                <span className="text-sm font-normal text-muted-foreground tabular-nums shrink-0 text-right">
                  {formatAmountWithCurrencyCode(
                    item.originalAmount,
                    item.currency,
                  )}
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {item.splits
                  .filter((s) => s.userId !== item.paidById)
                  .map((s) => {
                    const owesCurrentUser = item.paidById === currentUserId;
                    const currentUserOwes = s.userId === currentUserId;
                    const amountClass = owesCurrentUser
                      ? "text-positive"
                      : currentUserOwes
                        ? "text-negative"
                        : "text-muted-foreground";
                    return (
                      <span
                        key={s.userId}
                        className="inline-flex items-center gap-1.5"
                      >
                        <UserAvatar userId={s.userId} size="xs" />
                        {getDisplayName(
                          getMemberUser(s.userId),
                          currentUserId,
                        )}{" "}
                        {currentUserOwes ? "owe" : "owes"}{" "}
                        {getDisplayName(
                          getMemberUser(item.paidById),
                          currentUserId,
                        )}{" "}
                        <span className={amountClass}>
                          {formatAmount(s.amount, tabCurrency)}
                        </span>
                      </span>
                    );
                  })}
              </div>
              {!item.deletedAt && (
                <ExpenseReactions
                  expenseId={item.id}
                  tabId={tabId}
                  reactions={item.reactions ?? []}
                  currentUserId={currentUserId}
                  compact
                  getDisplayName={(userId) =>
                    getDisplayName(getMemberUser(userId), currentUserId)
                  }
                />
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
