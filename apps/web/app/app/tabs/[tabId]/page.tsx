"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchTab,
  fetchExpenses,
  fetchSettlements,
  fetchBalances,
} from "@/app/actions/queries";
import { authClient } from "@/lib/auth-client";
import { useParams } from "next/navigation";
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
import { getDisplayName } from "@/lib/display-name";
import { BanknoteArrowUp, CircleCheck } from "lucide-react";

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

  if (!tabId) return null;

  if (tabLoading || !tab) {
    return (
      <div className="flex min-h-[200px] items-center justify-center p-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const currentUserId = session?.user?.id ?? "";
  const otherMember = tab.members.find((m) => m.userId !== currentUserId)?.user;

  if (!otherMember) return null;

  const navTitle = tab.isDirect
    ? `Tab with ${getDisplayName(otherMember)}`
    : tab.name;

  useEffect(() => {
    setNavTitle?.({
      title: navTitle,
      backHref: tab.isDirect ? "/app/friends" : "/app/tabs",
    });
    return () => setNavTitle?.(null);
  }, [setNavTitle, navTitle, tab.isDirect]);

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
                  <p key={b.userId} className="text-muted-foreground">
                    {b.amount > 0
                      ? `${getDisplayName(b.user, currentUserId)} is owed $${b.amount.toFixed(2)}`
                      : `${getDisplayName(b.user, currentUserId)} owes $${Math.abs(b.amount).toFixed(2)}`}
                  </p>
                ))}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Settle up</CardTitle>
            <CardDescription>
              Record a payment between tab members
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SettleUpForm
              tabId={tabId}
              currentUserId={currentUserId}
              members={tab.members}
              balances={balances ?? []}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add expense</CardTitle>
            <CardDescription>Add a new expense to split</CardDescription>
          </CardHeader>
          <CardContent>
            <AddExpenseForm
              tabId={tabId}
              members={tab.members}
              currentUserId={currentUserId}
            />
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
                          <BanknoteArrowUp className="h-5 w-5 shrink-0 text-negative" />
                          <span className="min-w-0 flex-1 font-medium">
                            {item.description}
                          </span>
                          <span className="text-muted-foreground">
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
                          <CircleCheck className="h-5 w-5 shrink-0 text-positive" />
                          <span className="min-w-0 flex-1 font-medium">
                            {getDisplayName(item.fromUser, currentUserId)} paid{" "}
                            {getDisplayName(item.toUser, currentUserId)}
                          </span>
                          <span className="text-muted-foreground">
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
