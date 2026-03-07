"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchFriends } from "@/app/actions/queries";
import {
  getPendingFriendRequests,
  acceptFriendRequest,
  rejectFriendRequest,
} from "@/app/actions/friends";
import { Link as TransitionLink } from "next-view-transitions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getDisplayName } from "@/lib/display-name";
import { UserAvatar } from "@/components/user-avatar";

export default function FriendsPage() {
  const [rejectRequestId, setRejectRequestId] = useState<string | null>(null);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: friends, isLoading } = useQuery({
    queryKey: ["friends"],
    queryFn: fetchFriends,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const { data: requestsData, isLoading: requestsLoading } = useQuery({
    queryKey: ["pendingFriendRequests"],
    queryFn: async () => {
      const r = await getPendingFriendRequests();
      return r.success ? r.requests : [];
    },
    staleTime: 0,
    refetchOnMount: "always",
  });
  const pendingRequests = requestsData ?? [];

  async function handleAccept(requestId: string) {
    const formData = new FormData();
    formData.set("requestId", requestId);
    const result = await acceptFriendRequest(formData);
    if (result.success && result.friendTabId) {
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["tabs"] });
      queryClient.invalidateQueries({ queryKey: ["pendingFriendRequests"] });
      router.push(`/app/tabs/${result.friendTabId}`);
    }
  }

  async function handleReject(requestId: string) {
    const formData = new FormData();
    formData.set("requestId", requestId);
    await rejectFriendRequest(formData);
    queryClient.invalidateQueries({ queryKey: ["pendingFriendRequests"] });
    setRejectRequestId(null);
  }

  const rejectRequest = rejectRequestId
    ? pendingRequests.find((r) => r.id === rejectRequestId)
    : null;

  return (
    <div className="p-4">
      <div className="mx-auto max-w-2xl space-y-6">
        {!requestsLoading && pendingRequests.length > 0 && (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Friend requests</h2>
              <p className="text-sm text-muted-foreground">
                Accept or reject incoming friend requests
              </p>
            </div>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {pendingRequests.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-accent"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    <UserAvatar userId={r.fromUserId} size="sm" />
                    <div className="min-w-0 flex-1">
                      <span className="font-medium">
                        {r.fromUserName ?? r.fromUserUsername ?? "Unknown"}
                      </span>
                      <div className="mt-0.5 flex items-center gap-2">
                        {r.fromUserUsername && (
                          <span className="text-sm text-muted-foreground">
                            @{r.fromUserUsername}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(r.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
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
          </section>
        )}

        <AlertDialog
          open={rejectRequestId !== null}
          onOpenChange={(open) => !open && setRejectRequestId(null)}
        >
          <AlertDialogContent className="max-w-md rounded-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>Reject friend request?</AlertDialogTitle>
              <AlertDialogDescription>
                {rejectRequest
                  ? `Are you sure you want to reject the friend request from ${rejectRequest.fromUserName ?? rejectRequest.fromUserUsername ?? "this user"}?`
                  : "Are you sure you want to reject this friend request?"}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => rejectRequestId && handleReject(rejectRequestId)}
              >
                Reject
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Your friends</h2>
            <p className="text-sm text-muted-foreground">
              Tap to view split and add expenses
            </p>
          </div>
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
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <UserAvatar
                          userId={f.friend.id}
                          size="sm"
                          className="shrink-0"
                        />
                        <span className="font-medium truncate">
                          {getDisplayName(f.friend)}
                          {f.friend.username && (
                            <span className="ml-1 text-muted-foreground font-normal">
                              @{f.friend.username}
                            </span>
                          )}
                        </span>
                      </div>
                      <span
                        className={
                          f.balance > 0
                            ? "text-sm font-medium text-positive shrink-0"
                            : f.balance < 0
                              ? "text-sm font-medium text-negative shrink-0"
                              : "text-sm text-muted-foreground shrink-0"
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
                            }
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
