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
import { useNavTitle } from "@/app/app/context/nav-title-context";
import { AddExpenseForm } from "./add-expense-form";
import { SettleUpForm } from "./settle-up-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { BanknoteArrowUp, CircleCheck, Plus, UserPlus, Wallet } from "lucide-react";
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
  });

  const { data: expenses, isLoading: expensesLoading } = useQuery({
    queryKey: ["expenses", tabId],
    queryFn: () => fetchExpenses(tabId),
    enabled: !!tabId,
  });

  const { data: settlements, isLoading: settlementsLoading } = useQuery({
    queryKey: ["settlements", tabId],
    queryFn: () => fetchSettlements(tabId),
    enabled: !!tabId,
  });

  const { data: balances } = useQuery({
    queryKey: ["balances", tabId],
    queryFn: () => fetchBalances(tabId),
    enabled: !!tabId,
  });

  const [settleUpOpen, setSettleUpOpen] = useState(false);
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);

  const currentUserId = session?.user?.id ?? "";
  const otherMember = tab?.members?.find((m) => m.userId !== currentUserId)?.user;
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

  useEffect(() => {
    if (!tab) return;
    setNavTitle?.({
      title: navTitle,
      backHref: tab.isDirect ? "/app/friends" : "/app/tabs",
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
        <p className="text-muted-foreground">Tab not found or you don&apos;t have access</p>
        <Button variant="outline" asChild>
          <TransitionLink href="/app/tabs">Go back</TransitionLink>
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
  ].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div className="p-4 pb-20">
      <div className="mx-auto max-w-3xl space-y-6">
        {avatarUserIds.length === 0 && (
          <div className="rounded-lg border border-border bg-muted/50 p-4">
            <p className="mb-3 text-sm text-muted-foreground">
              {tab.isDirect
                ? "Add a friend to split expenses with"
                : "Add friends or invite members to this tab"}
            </p>
            <Button variant="secondary" className="w-full justify-center gap-2" asChild>
              <TransitionLink href={`/app/tabs/${tabId}/members`}>
                <UserPlus className="h-4 w-4" />
                {tab.isDirect ? "Add friend" : "Invite members"}
              </TransitionLink>
            </Button>
          </div>
        )}

        <div className="flex gap-2">
          <Dialog open={settleUpOpen} onOpenChange={setSettleUpOpen}>
            <DialogTrigger asChild>
              <Button
                variant="secondary"
                className="flex-1 justify-center gap-2"
              >
                <Wallet className="h-4 w-4" />
                Settle up
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
          <Dialog open={addExpenseOpen} onOpenChange={setAddExpenseOpen}>
            <DialogTrigger asChild>
              <Button
                variant="secondary"
                className="flex-1 justify-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add expense
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[90vw] rounded-xl">
              <DialogHeader>
                <DialogTitle>Add expense</DialogTitle>
                <DialogDescription>
                  Add a new expense to split
                </DialogDescription>
              </DialogHeader>
              <AddExpenseForm
                tabId={tabId}
                members={tab.members}
                currentUserId={currentUserId}
                onSuccess={() => setAddExpenseOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Balances</CardTitle>
            <CardDescription>Who owes whom in this tab</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {!balances || balances.length === 0 ? (
              <p className="text-muted-foreground">No balances yet</p>
            ) : (
              <>
                {youOwe.map((b) => (
                  <p key={b.userId} className="text-negative">
                    You owe ${Math.abs(b.amount).toFixed(2)}
                  </p>
                ))}
                {owedToYou.map((b) => (
                  <p key={b.userId} className="text-positive">
                    You are owed ${b.amount.toFixed(2)}
                  </p>
                ))}
                {others.map((b) => (
                  <div
                    key={b.userId}
                    className="flex items-center gap-3 text-muted-foreground"
                  >
                    <UserAvatar userId={b.userId} size="xs" />
                    <span>
                      {b.amount > 0
                        ? `${getDisplayName(b.user, currentUserId)} is owed $${b.amount.toFixed(2)}`
                        : `${getDisplayName(b.user, currentUserId)} owes $${Math.abs(b.amount).toFixed(2)}`}
                    </span>
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expenses</CardTitle>
            <CardDescription>
              All expenses and settlements in this tab
            </CardDescription>
          </CardHeader>
          <CardContent>
            {expensesLoading || settlementsLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : expensesAndSettlements.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
                No expenses or settlements yet
              </p>
            ) : (
              <div className="space-y-4">
                {expensesAndSettlements.map((item) =>
                  item.type === "expense" ? (
                    <Card key={`exp-${item.id}`}>
                      <CardContent className="flex flex-col gap-1 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <UserAvatar userId={item.paidById} size="xs" />
                            <BanknoteArrowUp className="h-5 w-5 shrink-0 text-negative" />
                            <span className="min-w-0 flex-1 font-medium">
                              {item.description}
                            </span>
                          </div>
                          <span className="text-muted-foreground shrink-0">
                            ${item.amount.toFixed(2)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Paid by {getDisplayName(item.paidBy, currentUserId)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Split:{" "}
                          {item.splits
                            .map(
                              (s) =>
                                `${getDisplayName(s.user, currentUserId)}: $${s.amount.toFixed(2)}`,
                            )
                            .join(", ")}
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card key={`set-${item.id}`}>
                      <CardContent className="flex flex-col gap-1 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <UserAvatar userId={item.fromUserId} size="xs" />
                            <CircleCheck className="h-5 w-5 shrink-0 text-positive" />
                            <span className="min-w-0 flex-1 font-medium">
                              {getDisplayName(item.fromUser, currentUserId)}{" "}
                              paid {getDisplayName(item.toUser, currentUserId)}
                            </span>
                          </div>
                          <span className="text-muted-foreground shrink-0">
                            ${item.amount.toFixed(2)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Settlement
                        </p>
                      </CardContent>
                    </Card>
                  ),
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
