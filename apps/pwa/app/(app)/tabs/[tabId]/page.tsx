"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchTab,
  fetchExpenses,
  fetchSettlements,
  fetchBalances,
} from "@/app/actions/queries";
import { authClient } from "@/lib/auth-client";
import { useParams } from "next/navigation";
import { Link as TransitionLink } from "next-view-transitions";
import { useNavTitle } from "../../context/nav-title-context";
import { SettleUpForm } from "./settle-up-form";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getDisplayName } from "@/lib/display-name";
import { UserAvatar } from "@/components/user-avatar";
import {
  BanknoteArrowUp,
  CircleCheck,
  Settings,
  UserPlus,
  Wallet,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

export default function TabPage() {
  const params = useParams<{ tabId: string }>();
  const tabId = params.tabId;
  const { data: session } = authClient.useSession();
  const setNavTitle = useNavTitle();

  const { data: tab, isLoading: tabLoading } = useQuery({
    queryKey: ["tab", tabId],
    queryFn: () => fetchTab(tabId),
    enabled: !!tabId,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: expenses, isLoading: expensesLoading } = useQuery({
    queryKey: ["expenses", tabId],
    queryFn: () => fetchExpenses(tabId),
    enabled: !!tabId,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: settlements, isLoading: settlementsLoading } = useQuery({
    queryKey: ["settlements", tabId],
    queryFn: () => fetchSettlements(tabId),
    enabled: !!tabId,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: balances } = useQuery({
    queryKey: ["balances", tabId],
    queryFn: () => fetchBalances(tabId),
    enabled: !!tabId,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const [settleUpOpen, setSettleUpOpen] = useState(false);

  const currentUserId = session?.user?.id ?? "";
  const otherMember = tab?.members?.find(
    (m) => m.userId !== currentUserId,
  )?.user;
  const navTitle = tab
    ? tab.isDirect && otherMember
      ? `Tab with ${getDisplayName(otherMember, currentUserId)}`
      : tab.name
    : "";
  const avatarUserIds = useMemo(
    () =>
      (tab?.members ?? [])
        .filter((m) => m.userId !== currentUserId)
        .map((m) => m.userId),
    [tab?.members, currentUserId],
  );
  const avatarDisplayName =
    tab?.isDirect && otherMember
      ? getDisplayName(otherMember, currentUserId)
      : undefined;
  const isAdmin =
    tab?.members?.find((m) => m.userId === currentUserId)?.role === "owner";

  useEffect(() => {
    if (!tab) return;
    setNavTitle?.({
      title: navTitle,
      backHref: tab.isDirect ? "/friends" : "/tabs",
      avatarUserIds,
      avatarDisplayName,
    });
    return () => setNavTitle?.(null);
  }, [setNavTitle, navTitle, tab, avatarUserIds, avatarDisplayName]);

  if (!tabId) return null;

  if (tabLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center p-4">
        <Spinner />
      </div>
    );
  }

  if (!tab) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 p-4">
        <p className="text-muted-foreground">
          Tab not found or you don&apos;t have access
        </p>
        <Button variant="outline" asChild>
          <TransitionLink href="/tabs">Go back</TransitionLink>
        </Button>
      </div>
    );
  }

  const youOwe =
    balances?.filter((b) => b.userId === currentUserId && b.amount < 0) ?? [];
  const owedToYou =
    balances?.filter((b) => b.userId === currentUserId && b.amount > 0) ?? [];
  const others = balances?.filter((b) => b.userId !== currentUserId) ?? [];

  const expensesAndSettlements = [
    ...(expenses ?? []).map((e) => ({ ...e, type: "expense" as const })),
    ...(settlements ?? []).map((s) => ({ ...s, type: "settlement" as const })),
  ].sort((a, b) => {
    const dateA = a.type === "expense" ? a.expenseDate : a.createdAt;
    const dateB = b.type === "expense" ? b.expenseDate : b.createdAt;
    return new Date(dateB).getTime() - new Date(dateA).getTime();
  });

  return (
    <div className="p-4 pb-20">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex gap-2 overflow-x-auto overflow-y-hidden -mx-1 px-1 app-scroll-hide">
          {!tab.isDirect && isAdmin && (
            <Button
              variant="secondary"
              className="shrink-0 justify-center gap-2 min-w-28"
              asChild
            >
              <TransitionLink href={`/tabs/${tabId}/manage`}>
                <Settings className="h-4 w-4" />
                Manage
              </TransitionLink>
            </Button>
          )}
          {!tab.isDirect && avatarUserIds.length > 0 && (
            <Button
              variant="secondary"
              className="shrink-0 justify-center gap-2 min-w-28"
              asChild
            >
              <TransitionLink href={`/tabs/${tabId}/members`}>
                <UserPlus className="h-4 w-4" />
                Members
              </TransitionLink>
            </Button>
          )}
          <Dialog open={settleUpOpen} onOpenChange={setSettleUpOpen}>
            <DialogTrigger asChild>
              <Button
                variant="positive"
                className="shrink-0 justify-center gap-2 min-w-28"
              >
                <Wallet className="h-4 w-4" />
                Settle
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[90vw] rounded-xl">
              <DialogHeader>
                <DialogTitle>Settle up</DialogTitle>
                <DialogDescription>
                  Record a payment between tab members
                </DialogDescription>
              </DialogHeader>
              <SettleUpForm
                tabId={tabId}
                currentUserId={currentUserId}
                members={tab.members}
                balances={balances ?? []}
                onSuccess={() => setSettleUpOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>

        {!tab.isDirect && avatarUserIds.length === 0 && (
          <div className="rounded-lg border border-border bg-muted/50 p-4">
            <p className="mb-3 text-sm text-muted-foreground">
              Add friends or invite members to this tab to start splitting
              expenses
            </p>
            <Button
              variant="default"
              className="w-full justify-center gap-2"
              asChild
            >
              <TransitionLink href={`/tabs/${tabId}/members`}>
                <UserPlus className="h-4 w-4" />
                Invite members
              </TransitionLink>
            </Button>
          </div>
        )}
        <section>
          <h2 className="text-base font-medium mb-2">Balances</h2>
          <Card>
            <CardContent className="p-4">
              {!balances || balances.length === 0 ? (
                <p className="text-muted-foreground text-sm">No balances yet</p>
              ) : (
                <div className="space-y-2">
                  {youOwe.map((b) => (
                    <p key={b.userId} className="text-negative text-sm">
                      You owe ${Math.abs(b.amount).toFixed(2)}
                    </p>
                  ))}
                  {owedToYou.map((b) => (
                    <p key={b.userId} className="text-positive text-sm">
                      You are owed ${b.amount.toFixed(2)}
                    </p>
                  ))}
                  {others.map((b) => (
                    <div
                      key={b.userId}
                      className="flex items-center gap-2 text-muted-foreground text-xs"
                    >
                      <UserAvatar userId={b.userId} size="xs" />
                      <span>
                        {b.amount > 0
                          ? `${getDisplayName(b.user, currentUserId)} is owed $${b.amount.toFixed(2)}`
                          : `${getDisplayName(b.user, currentUserId)} owes $${Math.abs(b.amount).toFixed(2)}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section>
          <h2 className="text-base font-medium mb-1">Expenses</h2>
          <p className="text-xs text-muted-foreground mb-4">
            All expenses and settlements in this tab
          </p>
          {expensesLoading || settlementsLoading ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : expensesAndSettlements.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground text-sm">
              No expenses or settlements yet
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {expensesAndSettlements.map((item) =>
                item.type === "expense" ? (
                  <TransitionLink
                    key={`exp-${item.id}`}
                    href={`/tabs/${tabId}/expenses/${item.id}`}
                  >
                    <Card className="cursor-pointer transition-colors hover:bg-muted/50">
                      <CardContent className="flex flex-col gap-1 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <BanknoteArrowUp className="h-5 w-5 shrink-0 text-negative" />
                          <span className="min-w-0 flex-1 font-medium text-sm">
                            {item.description}
                          </span>
                          <span className="text-foreground shrink-0 font-medium">
                            ${item.amount.toFixed(2)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 mb-2">
                          Paid by{" "}
                          <span className="inline-flex items-center gap-1.5">
                            <UserAvatar userId={item.paidById} size="xs" />
                            {getDisplayName(item.paidBy, currentUserId)}
                          </span>
                          <span>
                            ·{" "}
                            {new Date(item.expenseDate).toLocaleDateString(
                              undefined,
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              },
                            )}
                          </span>
                        </p>
                        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                          {item.splits
                            .filter((s) => s.userId !== item.paidById)
                            .map((s) => {
                              const owesCurrentUser =
                                item.paidById === currentUserId;
                              const currentUserOwes =
                                s.userId === currentUserId;
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
                                    s.user,
                                    currentUserId,
                                  )} owes{" "}
                                  {getDisplayName(item.paidBy, currentUserId)}{" "}
                                  <span className={amountClass}>
                                    ${s.amount.toFixed(2)}
                                  </span>
                                </span>
                              );
                            })}
                        </div>
                      </CardContent>
                    </Card>
                  </TransitionLink>
                ) : (
                  <Card key={`set-${item.id}`}>
                    <CardContent className="flex flex-col gap-2 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <UserAvatar userId={item.fromUserId} size="sm" />
                            <span className="font-medium text-sm truncate">
                              {getDisplayName(item.fromUser, currentUserId)}
                            </span>
                          </div>
                          <p className="flex items-center gap-2 pl-7 text-sm text-muted-foreground">
                            paid{" "}
                            <UserAvatar userId={item.toUserId} size="xs" />
                            <span className="truncate">
                              {getDisplayName(item.toUser, currentUserId)}
                            </span>
                          </p>
                        </div>
                        <span className="shrink-0 font-semibold text-positive">
                          ${item.amount.toFixed(2)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.createdAt).toLocaleDateString(
                          undefined,
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          },
                        )}
                      </p>
                    </CardContent>
                  </Card>
                ),
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
