import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  getGroupWithMembers,
  getExpensesForGroup,
  getBalancesForGroup,
} from "@/lib/data";
import Link from "next/link";
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

export default async function GroupPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/login");
  }

  const group = await getGroupWithMembers(groupId);
  if (!group) {
    notFound();
  }

  const isMember = group.members.some((m) => m.userId === session.user.id);
  if (!isMember) {
    redirect("/groups");
  }

  const [expenses, balances] = await Promise.all([
    getExpensesForGroup(groupId),
    getBalancesForGroup(groupId),
  ]);

  const youOwe = balances.filter((b) => b.userId === session.user.id && b.amount < 0);
  const owedToYou = balances.filter((b) => b.userId === session.user.id && b.amount > 0);
  const others = balances.filter((b) => b.userId !== session.user.id);

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="flex items-center justify-between">
          <Button variant="ghost" asChild>
            <Link href="/groups">Back to groups</Link>
          </Button>
          <span className="text-sm text-muted-foreground">
            {session.user.email}
          </span>
        </div>

        <h1 className="text-2xl font-bold">{group.name}</h1>

        <Card>
          <CardHeader>
            <CardTitle>Balances</CardTitle>
            <CardDescription>Who owes whom in this group</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {balances.length === 0 ? (
              <p className="text-muted-foreground">No balances yet</p>
            ) : (
              <>
                {youOwe.map((b) => (
                  <p key={b.userId} className="text-destructive">
                    You owe {b.user.name ?? b.user.email} $
                    {Math.abs(b.amount).toFixed(2)}
                  </p>
                ))}
                {owedToYou.map((b) => (
                  <p key={b.userId} className="text-green-600 dark:text-green-400">
                    {b.user.name ?? b.user.email} owes you $
                    {b.amount.toFixed(2)}
                  </p>
                ))}
                {others.map((b) => (
                  <p key={b.userId} className="text-muted-foreground">
                    {b.amount > 0
                      ? `${b.user.name ?? b.user.email} is owed $${b.amount.toFixed(2)}`
                      : `${b.user.name ?? b.user.email} owes $${Math.abs(b.amount).toFixed(2)}`}
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
              currentUserId={session.user.id}
              balances={balances}
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
              currentUserId={session.user.id}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expenses</CardTitle>
            <CardDescription>All expenses in this group</CardDescription>
          </CardHeader>
          <CardContent>
            {expenses.length === 0 ? (
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
                        Paid by {exp.paidBy.name ?? exp.paidBy.email}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Split:{" "}
                        {exp.splits
                          .map(
                            (s) =>
                              `${s.user.name ?? s.user.email}: $${s.amount.toFixed(2)}`
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
    </main>
  );
}
