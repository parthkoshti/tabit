"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Link as TransitionLink } from "next-view-transitions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getDisplayName } from "@/lib/display-name";
import { UserAvatar } from "@/components/user-avatar";
import { Skeleton } from "@/components/ui/skeleton";

export default function FriendsPage() {
  const [rejectRequestId, setRejectRequestId] = useState<string | null>(null);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: friendsData, isLoading } = useQuery({
    queryKey: ["friends"],
    queryFn: async () => {
      const r = await api.friends.list();
      return (r.success ? r.friends : []) as Array<{
        id: string;
        balance: number;
        expenseCount: number;
        lastExpenseDate?: string | null;
        friend: { id: string; email: string; name: string | null; username: string | null };
      }>;
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const friends = friendsData ?? [];
  const { data: requestsData, isLoading: requestsLoading } = useQuery({
    queryKey: ["pendingFriendRequests"],
    queryFn: async () => {
      const r = await api.friends.getPendingRequests();
      return r.success ? r.requests : [];
    },
    staleTime: 0,
    refetchOnMount: "always",
  });
  const pendingRequests = requestsData ?? [];

  async function handleAccept(requestId: string) {
    const result = await api.friends.acceptRequest(requestId);
    if (result.success && result.friendTabId) {
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["tabs"] });
      queryClient.invalidateQueries({ queryKey: ["pendingFriendRequests"] });
      router.push(`/app/tabs/${result.friendTabId}`);
    }
  }

  async function handleReject(requestId: string) {
    await api.friends.rejectRequest(requestId);
    queryClient.invalidateQueries({ queryKey: ["pendingFriendRequests"] });
    setRejectRequestId(null);
  }

  const rejectRequest = rejectRequestId
    ? pendingRequests.find((r) => r.id === rejectRequestId)
    : null;

  return (
    <div className="p-4">
      <div className="mx-auto max-w-2xl space-y-6">
        {(requestsLoading || pendingRequests.length > 0) && (
          <section className="space-y-4">
            <h2 className="text-base font-medium mb-1">Friend requests</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Accept or reject incoming friend requests
            </p>
            {requestsLoading ? (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {[1, 2, 3].map((i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-4 px-4 py-3"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-4">
                      <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Skeleton className="h-8 w-16 rounded-md" />
                      <Skeleton className="h-8 w-16 rounded-md" />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {pendingRequests.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-accent"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-4">
                      <UserAvatar userId={r.fromUserId} size="sm" />
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="font-medium">
                          {r.fromUserName ?? r.fromUserUsername ?? "Unknown"}
                        </div>
                        {r.fromUserUsername && (
                          <div className="text-sm text-muted-foreground">
                            @{r.fromUserUsername}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {new Date(r.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => setRejectRequestId(r.id)}
                      >
                        Reject
                      </Button>
                      <Button size="sm" onClick={() => handleAccept(r.id)}>
                        Accept
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <Dialog
          open={rejectRequestId !== null}
          onOpenChange={(open) => !open && setRejectRequestId(null)}
        >
          <DialogContent className="max-w-[90vw] rounded-lg">
            <DialogHeader>
              <DialogTitle>Reject friend request?</DialogTitle>
              <DialogDescription>
                {rejectRequest
                  ? `Are you sure you want to reject the friend request from ${rejectRequest.fromUserName ?? rejectRequest.fromUserUsername ?? "this user"}?`
                  : "Are you sure you want to reject this friend request?"}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setRejectRequestId(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => rejectRequestId && handleReject(rejectRequestId)}
              >
                Reject
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <section className="space-y-4">
          <h2 className="text-base font-medium mb-1">Your friends</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Tap to view split and add expenses
          </p>
          {isLoading ? (
            <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
              Loading...
            </p>
          ) : !friends || friends.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
              No friends yet. Use the add button above to add one.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {friends.map((f) => (
                <TransitionLink key={f.id} href={`/app/tabs/${f.id}`}>
                  <div className="flex flex-col gap-2 rounded-xl border border-border bg-card/50 p-4 transition-colors hover:bg-muted/50 hover:border-border/80">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <UserAvatar
                          userId={f.friend.id}
                          size="sm"
                          className="shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">
                            {getDisplayName(f.friend)}
                          </div>
                          {f.friend.username && (
                            <div className="truncate text-sm text-muted-foreground">
                              @{f.friend.username}
                            </div>
                          )}
                        </div>
                      </div>
                      <span
                        className={
                          f.balance > 0
                            ? "shrink-0 text-sm font-medium text-positive"
                            : f.balance < 0
                              ? "shrink-0 text-sm font-medium text-negative"
                              : "shrink-0 text-sm text-muted-foreground"
                        }
                      >
                        {f.balance > 0
                          ? `They owe you $${f.balance.toFixed(2)}`
                          : f.balance < 0
                            ? `You owe $${Math.abs(f.balance).toFixed(2)}`
                            : "Settled up"}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {f.expenseCount === 0
                        ? "No expenses yet"
                        : `${f.expenseCount} expense${f.expenseCount === 1 ? "" : "s"}`}
                      {f.lastExpenseDate && (
                        <>
                          {" "}
                          &middot;{" "}
                          {new Date(f.lastExpenseDate).toLocaleDateString(
                            undefined,
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            },
                          )}
                        </>
                      )}
                    </span>
                  </div>
                </TransitionLink>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
