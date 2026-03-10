"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchExpense,
  fetchExpenseAuditLog,
  fetchTab,
} from "@/app/actions/queries";
import { authClient } from "@/lib/auth-client";
import { useNavTitle } from "../../../../context/nav-title-context";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { EditExpenseForm } from "../../edit-expense-form";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, BanknoteArrowUp, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { getDisplayName } from "@/lib/display-name";
import { UserAvatar } from "@/components/user-avatar";

export default function ExpensePage() {
  const params = useParams<{ tabId: string; expenseId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabId = params.tabId;
  const expenseId = params.expenseId;
  const { data: session } = authClient.useSession();
  const setNavTitle = useNavTitle();
  const queryClient = useQueryClient();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { data: expense, isLoading: expenseLoading } = useQuery({
    queryKey: ["expense", expenseId],
    queryFn: () => fetchExpense(expenseId),
    enabled: !!expenseId,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: tab } = useQuery({
    queryKey: ["tab", tabId],
    queryFn: () => fetchTab(tabId),
    enabled: !!tabId,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: auditLog } = useQuery({
    queryKey: ["expenseAuditLog", expenseId],
    queryFn: () => fetchExpenseAuditLog(expenseId),
    enabled: !!expenseId && !!expense,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    setNavTitle?.({
      title: expense ? expense.description : "Expense",
      backHref: `/tabs/${tabId}`,
      icon: <BanknoteArrowUp className="h-5 w-5 shrink-0 text-negative" />,
    });
    return () => setNavTitle?.(null);
  }, [setNavTitle, expense, tabId]);

  useEffect(() => {
    if (expense && tab && searchParams.get("edit") === "1") {
      setEditDialogOpen(true);
      router.replace(`/tabs/${tabId}/expenses/${expenseId}`, { scroll: false });
    }
  }, [expense, tab, searchParams, router, tabId, expenseId]);

  if (!tabId || !expenseId) return null;

  if (expenseLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center p-4">
        <Spinner />
      </div>
    );
  }

  if (!expense) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 p-4">
        <p className="text-muted-foreground">
          Expense not found or you don't have access
        </p>
        <Button variant="outline" asChild>
          <Link href={`/tabs/${tabId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to tab
          </Link>
        </Button>
      </div>
    );
  }

  const currentUserId = session?.user?.id ?? "";

  function formatAuditDate(date: Date) {
    return new Date(date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function getAddedAndRemovedParticipantIds(
    changes: Record<string, { from: unknown; to: unknown }>,
  ): { added: string[]; removed: string[] } {
    let fromIds: string[] = [];
    let toIds: string[] = [];
    if (changes.participants) {
      fromIds = (changes.participants.from as string[]) ?? [];
      toIds = (changes.participants.to as string[]) ?? [];
    } else if (changes.splits) {
      const from = (changes.splits.from as Record<string, number>) ?? {};
      const to = (changes.splits.to as Record<string, number>) ?? {};
      fromIds = Object.keys(from);
      toIds = Object.keys(to);
    }
    const fromSet = new Set(fromIds);
    const toSet = new Set(toIds);
    const added = toIds.filter((id) => !fromSet.has(id));
    const removed = fromIds.filter((id) => !toSet.has(id));
    return { added, removed };
  }

  function formatChanges(
    changes: Record<string, { from: unknown; to: unknown }>,
  ) {
    const parts: string[] = [];
    if (changes.expenseDate) {
      const from = new Date(changes.expenseDate.from as Date);
      const to = new Date(changes.expenseDate.to as Date);
      parts.push(
        `Date ${from.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} to ${to.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`,
      );
    }
    if (changes.amount) {
      const from = Number(changes.amount.from);
      const to = Number(changes.amount.to);
      parts.push(`Amount $${from.toFixed(2)} to $${to.toFixed(2)}`);
    }
    if (changes.description) {
      parts.push("Description updated");
    }
    if (changes.paidById) {
      parts.push("Payer updated");
    }
    if (changes.participants || changes.splits) {
      parts.push("Split updated");
    }
    return parts.join(" · ");
  }

  async function handleDelete() {
    setDeleteDialogOpen(false);
    setDeleteLoading(true);
    const result = await api.expenses.delete(tabId, expenseId);
    if (result.success) {
      queryClient.invalidateQueries({ queryKey: ["expenses", tabId] });
      queryClient.invalidateQueries({ queryKey: ["balances", tabId] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      toast.success("Expense deleted");
      router.push(`/tabs/${tabId}`);
    } else {
      toast.error(result.error ?? "Failed to delete expense");
    }
    setDeleteLoading(false);
  }

  return (
    <div className="p-4 pb-20">
      <div className="mx-auto max-w-md space-y-8">
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="flex items-center gap-2 text-xl font-medium text-foreground">
                <UserAvatar userId={expense.paidById} size="lg" />
                {getDisplayName(expense.paidBy, currentUserId)}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {new Date(expense.expenseDate).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
            <span className="text-foreground shrink-0 font-medium text-2xl">
              ${expense.amount.toFixed(2)}
            </span>
          </div>

          <div className="mb-4 flex gap-2">
            <Button
              className="flex-1"
              onClick={() => setEditDialogOpen(true)}
              variant={"secondary"}
              size="sm"
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={deleteLoading}
              onClick={() => setDeleteDialogOpen(true)}
              size="sm"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground pt-2">
            {expense.splits
              .filter((s) => s.userId !== expense.paidById)
              .map((s) => {
                const owesCurrentUser = expense.paidById === currentUserId;
                const currentUserOwes = s.userId === currentUserId;
                const amountClass = owesCurrentUser
                  ? "text-positive"
                  : currentUserOwes
                    ? "text-negative"
                    : "text-muted-foreground";
                return (
                  <span
                    key={s.userId}
                    className="inline-flex items-center gap-2"
                  >
                    <UserAvatar userId={s.userId} size="sm" />
                    {getDisplayName(s.user, currentUserId)} owes{" "}
                    {getDisplayName(expense.paidBy, currentUserId)}{" "}
                    <span className={amountClass}>${s.amount.toFixed(2)}</span>
                  </span>
                );
              })}
          </div>
        </div>

        {auditLog && auditLog.length > 0 && (
          <section>
            <h2 className="text-base font-medium mb-3">History</h2>
            <ul className="space-y-4 text-sm">
              {auditLog.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-start gap-2 text-muted-foreground"
                >
                  <UserAvatar userId={entry.performedById} size="xs" />
                  <span>
                    {entry.action === "create" && (
                      <>
                        Created by{" "}
                        {getDisplayName(entry.performedBy, currentUserId)}{" "}
                        {formatAuditDate(entry.performedAt)}
                      </>
                    )}
                    {entry.action === "update" && (
                      <>
                        <span className="block text-foreground/90">
                          {entry.changes
                            ? formatChanges(entry.changes)
                            : "Edited"}
                        </span>
                        {entry.changes &&
                          (entry.changes.participants ||
                            entry.changes.splits) &&
                          (() => {
                            const { added, removed } =
                              getAddedAndRemovedParticipantIds(entry.changes);
                            const members = tab?.members ?? [];
                            const hasChanges =
                              added.length > 0 || removed.length > 0;
                            if (!hasChanges) return null;
                            return (
                              <ul className="mt-2 space-y-1 text-xs">
                                {removed
                                  .filter((id) =>
                                    members.some((m) => m.userId === id),
                                  )
                                  .map((userId) => (
                                    <li
                                      key={userId}
                                      className="flex items-center gap-1.5"
                                    >
                                      <span className="text-negative">
                                        Removed
                                      </span>
                                      <UserAvatar userId={userId} size="xs" />
                                      {getDisplayName(
                                        members.find(
                                          (m) => m.userId === userId,
                                        )!.user,
                                        currentUserId,
                                      )}
                                    </li>
                                  ))}
                                {added
                                  .filter((id) =>
                                    members.some((m) => m.userId === id),
                                  )
                                  .map((userId) => (
                                    <li
                                      key={userId}
                                      className="flex items-center gap-1.5"
                                    >
                                      <span className="text-positive">
                                        added
                                      </span>
                                      <UserAvatar userId={userId} size="xs" />
                                      {getDisplayName(
                                        members.find(
                                          (m) => m.userId === userId,
                                        )!.user,
                                        currentUserId,
                                      )}
                                    </li>
                                  ))}
                              </ul>
                            );
                          })()}
                        <span className="block text-xs text-muted-foreground/80 mt-2">
                          {getDisplayName(entry.performedBy, currentUserId)} ·{" "}
                          {formatAuditDate(entry.performedAt)}
                        </span>
                      </>
                    )}
                    {entry.action === "delete" && (
                      <>
                        Deleted by{" "}
                        {getDisplayName(entry.performedBy, currentUserId)}{" "}
                        {formatAuditDate(entry.performedAt)}
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="max-w-[90vw] rounded-lg">
            <DialogHeader>
              <DialogTitle>Delete expense?</DialogTitle>
              <DialogDescription>
                This will permanently delete this expense and cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => handleDelete()}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-[90vw] rounded-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit expense</DialogTitle>
              <DialogDescription>Update the expense details</DialogDescription>
            </DialogHeader>
            <EditExpenseForm
              expenseId={expenseId}
              tabId={tabId}
              expense={expense}
              members={tab?.members ?? []}
              currentUserId={currentUserId}
              onSuccess={() => {
                setEditDialogOpen(false);
                queryClient.invalidateQueries({
                  queryKey: ["expenseAuditLog", expenseId],
                });
                queryClient.invalidateQueries({
                  queryKey: ["expense", expenseId],
                });
              }}
              onDeleteSuccess={() => router.push(`/tabs/${tabId}`)}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
