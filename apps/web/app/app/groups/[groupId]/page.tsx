"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchGroup,
  fetchExpenses,
  fetchBalances,
} from "@/app/actions/queries";
import { authClient } from "@/lib/auth-client";
import { useParams } from "next/navigation";
import { Link as TransitionLink } from "next-view-transitions";
import { Button } from "@/components/ui/button";
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

export default function GroupPage() {
  const params = useParams<{ groupId: string }>();
  const groupId = params.groupId;
  const { data: session } = authClient.useSession();

  const { data: group, isLoading: groupLoading } = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => fetchGroup(groupId),
    enabled: !!groupId,
  });

  const { data: expenses, isLoading: expensesLoading } = useQuery({
    queryKey: ["expenses", groupId],
    queryFn: () => fetchExpenses(groupId),
    enabled: !!groupId,
  });

  const { data: balances } = useQuery({
    queryKey: ["balances", groupId],
    queryFn: () => fetchBalances(groupId),
    enabled: !!groupId,
  });

  if (!groupId) return null;

  if (groupLoading || !group) {
    return (
      <div className="flex min-h-[200px] items-center justify-center p-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const currentUserId = session?.user?.id ?? "";
  const youOwe =
    balances?.filter((b) => b.userId === currentUserId && b.amount < 0) ?? [];
  const owedToYou =
    balances?.filter((b) => b.userId === currentUserId && b.amount > 0) ?? [];
  const others =
    balances?.filter((b) => b.userId !== currentUserId) ?? [];

  return (
    <div className="p-4">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild>
            <TransitionLink href={group.isDirect ? "/app/friends" : "/app/groups"}>
              Back to {group.isDirect ? "friends" : "groups"}
            </TransitionLink>
          </Button>
        </div>

        <h1 className="text-2xl font-bold">
          {group.isDirect
            ? `Split with ${(() => {
                const other = group.members.find((m) => m.userId !== currentUserId)?.user;
                return other ? getDisplayName(other) : "Friend";
              })()}`
            : group.name}
        </h1>

        <Card>
          <CardHeader>
            <CardTitle>Balances</CardTitle>
            <CardDescription>Who owes whom in this group</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {!balances || balances.length === 0 ? (
              <p className="text-muted-foreground">No balances yet</p>
            ) : (
              <>
                {youOwe.map((b) => (
                  <p key={b.userId} className="text-destructive">
                    You owe {getDisplayName(b.user)} $
                    {Math.abs(b.amount).toFixed(2)}
                  </p>
                ))}
                {owedToYou.map((b) => (
                  <p key={b.userId} className="text-green-600 dark:text-green-400">
                    {getDisplayName(b.user)} owes you $
                    {b.amount.toFixed(2)}
                  </p>
                ))}
                {others.map((b) => (
                  <p key={b.userId} className="text-muted-foreground">
                    {b.amount > 0
                      ? `${getDisplayName(b.user)} is owed $${b.amount.toFixed(2)}`
                      : `${getDisplayName(b.user)} owes $${Math.abs(b.amount).toFixed(2)}`}
                  </p>
                ))}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Settle up</CardTitle>
            <CardDescription>Record a payment to clear a debt</CardDescription>
          </CardHeader>
          <CardContent>
            <SettleUpForm
              groupId={groupId}
              currentUserId={currentUserId}
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
              groupId={groupId}
              members={group.members}
              currentUserId={currentUserId}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expenses</CardTitle>
            <CardDescription>All expenses in this group</CardDescription>
          </CardHeader>
          <CardContent>
            {expensesLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : !expenses || expenses.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
                No expenses yet
              </p>
            ) : (
              <div className="space-y-4">
                {expenses.map((exp) => (
                  <Card key={exp.id}>
                    <CardContent className="flex flex-col gap-1 p-4">
                      <div className="flex justify-between">
                        <span className="font-medium">{exp.description}</span>
                        <span className="text-muted-foreground">
                          ${exp.amount.toFixed(2)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Paid by {getDisplayName(exp.paidBy)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Split:{" "}
                        {exp.splits
                          .map(
                            (s) =>
                              `${getDisplayName(s.user)}: $${s.amount.toFixed(2)}`
                          )
                          .join(", ")}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
