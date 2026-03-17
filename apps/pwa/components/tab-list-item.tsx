import { Link } from "react-router-dom";
import { UserAvatar } from "@/components/user-avatar";
import { formatAmount } from "@/lib/format-amount";
import { cn } from "@/lib/utils";

export type TabListItemGroup = {
  type: "group";
  id: string;
  name: string;
  balance: number;
  currency: string;
  expenseCount: number;
  lastExpenseDate?: string | Date | null;
  memberUserIds?: string[];
};

export type TabListItemDirect = {
  type: "direct";
  id: string;
  displayName: string;
  username?: string | null;
  balance: number;
  currency: string;
  expenseCount: number;
  lastExpenseDate?: string | Date | null;
  friendId: string;
};

export type TabListItemData = TabListItemGroup | TabListItemDirect;

type TabListItemProps = {
  item: TabListItemData;
  currentUserId: string;
  href?: string;
  onClick?: () => void;
  renderActions?: () => React.ReactNode;
  className?: string;
};

export function TabListItem({
  item,
  currentUserId,
  href,
  onClick,
  renderActions,
  className,
}: TabListItemProps) {
  const isDirect = item.type === "direct";

  const allMemberIds =
    item.type === "group" ? (item.memberUserIds ?? []) : [];
  const currentUserFirst =
    allMemberIds.length > 0
      ? [
          currentUserId,
          ...allMemberIds.filter((id) => id !== currentUserId),
        ]
      : [];
  const hasExtra = currentUserFirst.length > 3;
  const displayMemberIds = hasExtra
    ? currentUserFirst.slice(0, 2)
    : currentUserFirst.slice(0, 3);
  const extraCount = hasExtra ? currentUserFirst.length - 2 : 0;

  const displayName = isDirect ? item.displayName : item.name;

  const balanceText = isDirect
    ? item.balance > 0
      ? `Owes you ${formatAmount(item.balance, item.currency)}`
      : item.balance < 0
        ? `You owe ${formatAmount(Math.abs(item.balance), item.currency)}`
        : "Settled up"
    : item.balance > 0
      ? `+${formatAmount(item.balance, item.currency)}`
      : item.balance < 0
        ? `-${formatAmount(Math.abs(item.balance), item.currency)}`
        : "Settled";

  const balanceClassName =
    item.balance > 0
      ? "text-sm font-medium text-positive shrink-0"
      : item.balance < 0
        ? "text-sm font-medium text-negative shrink-0"
        : "text-sm text-muted-foreground shrink-0";

  const expenseMeta = (
    <span className="text-xs text-muted-foreground">
      {item.expenseCount === 0
        ? "No expenses yet"
        : `${item.expenseCount} expense${item.expenseCount === 1 ? "" : "s"}`}
      {item.lastExpenseDate && (
        <>
          {" "}
          &middot;{" "}
          {new Date(item.lastExpenseDate).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </>
      )}
    </span>
  );

  const cardContent = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          {isDirect ? (
            <UserAvatar userId={item.friendId} size="sm" className="shrink-0" />
          ) : null}
          <div className="min-w-0 flex-1 space-y-0.5">
            <span className="font-medium text-sm">{displayName}</span>
            {isDirect && item.username && (
              <div className="truncate text-sm text-muted-foreground">
                @{item.username}
              </div>
            )}
          </div>
        </div>
        <span className={balanceClassName}>{balanceText}</span>
      </div>
      {!isDirect && displayMemberIds.length > 0 && (
        <div className="flex -space-x-2">
          {displayMemberIds.map((userId) => (
            <UserAvatar
              key={userId}
              userId={userId}
              size="xs"
              className="ring-2 ring-background"
            />
          ))}
          {extraCount > 0 && (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium ring-2 ring-background">
              +{extraCount}
            </span>
          )}
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        {expenseMeta}
        {renderActions?.()}
      </div>
    </>
  );

  const baseClassName =
    "flex w-full flex-col gap-2 rounded-xl border border-border bg-card/50 p-4 text-left transition-colors hover:bg-muted/50 hover:border-border/80";

  if (href) {
    return (
      <Link to={href} className={cn(baseClassName, className)}>
        {cardContent}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(baseClassName, className)}
      >
        {cardContent}
      </button>
    );
  }

  return <div className={cn(baseClassName, className)}>{cardContent}</div>;
}
