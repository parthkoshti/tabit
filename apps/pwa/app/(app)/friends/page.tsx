import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { toast } from "sonner";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/animations";
import { AnimatedCard } from "@/components/motion/animated-card";
import { PokeIcon } from "@/components/icons/poke-icon";
import { TabListItem } from "@/components/tab-list-item";
import { authClient } from "@/lib/auth-client";
import { SortDesc } from "lucide-react";

type FriendSort = "expenses" | "recent" | "name";

function getFirstNameForSort(f: {
  friend: {
    name?: string | null;
    username?: string | null;
    email?: string | null;
  };
}): string {
  const name = f.friend.name?.trim();
  if (name) {
    const first = name.split(/\s+/).filter(Boolean)[0];
    return (first ?? name).toLowerCase();
  }
  return (f.friend.username ?? f.friend.email ?? "").toLowerCase();
}

export function FriendsPage() {
  const [rejectRequestId, setRejectRequestId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<FriendSort>("expenses");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const currentUserId = session?.user?.id ?? "";
  const { data: friendsData, isLoading } = useQuery({
    queryKey: ["friends"],
    queryFn: async () => {
      const r = await api.friends.list();
      return (r.success ? r.friends : []) as Array<{
        id: string;
        currency?: string;
        balance: number;
        expenseCount: number;
        lastExpenseDate?: string | null;
        friend: {
          id: string;
          email: string;
          name: string | null;
          username: string | null;
        };
      }>;
    },
  });
  const friends = useMemo(() => friendsData ?? [], [friendsData]);
  const sortedFriends = useMemo(() => {
    const arr = [...friends];
    if (sortBy === "name") {
      arr.sort((a, b) =>
        getFirstNameForSort(a).localeCompare(getFirstNameForSort(b)),
      );
    } else if (sortBy === "recent") {
      arr.sort((a, b) => {
        const aDate = a.lastExpenseDate
          ? new Date(a.lastExpenseDate).getTime()
          : 0;
        const bDate = b.lastExpenseDate
          ? new Date(b.lastExpenseDate).getTime()
          : 0;
        return bDate - aDate;
      });
    } else {
      arr.sort((a, b) => (b.expenseCount ?? 0) - (a.expenseCount ?? 0));
    }
    return arr;
  }, [friends, sortBy]);
  const { data: requestsData, isLoading: requestsLoading } = useQuery({
    queryKey: ["pendingFriendRequests"],
    queryFn: async () => {
      const r = await api.friends.getPendingRequests();
      return r.success ? r.requests : [];
    },
  });
  const pendingRequests = requestsData ?? [];

  async function handleAccept(requestId: string) {
    const result = await api.friends.acceptRequest(requestId);
    if (result.success && result.friendTabId) {
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["tabs"] });
      queryClient.invalidateQueries({ queryKey: ["pendingFriendRequests"] });
      navigate(`/tabs/${result.friendTabId}`);
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

  async function handlePoke(friendTabId: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if ("vibrate" in navigator) {
      navigator.vibrate(100);
    }
    const result = await api.friends.poke(friendTabId);
    if (result.success) {
      toast.success("Poked!");
    } else {
      toast.error(result.error ?? "Failed to poke");
    }
  }

  return (
    <div className="p-4">
      <div className="mx-auto max-w-2xl space-y-6 pb-60">
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
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-foreground">
                Your friends
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Tap to view split and add expenses
              </p>
            </div>
            {friends.length > 0 && (
              <Select
                value={sortBy}
                onValueChange={(v) => setSortBy(v as FriendSort)}
              >
                <SelectTrigger className="shrink-0 w-fit max-w-34 h-8 text-xs">
                  <SortDesc className="h-4 w-4 shrink-0 opacity-70 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expenses">Most expenses</SelectItem>
                  <SelectItem value="recent">Most recent</SelectItem>
                  <SelectItem value="name">Alphabetical</SelectItem>
                </SelectContent>
              </Select>
            )}
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
            <motion.div
              className="flex flex-col gap-3"
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
              {sortedFriends.map((f) => (
                <motion.div key={f.id} variants={staggerItem}>
                  <AnimatedCard>
                    <TabListItem
                      item={{
                        type: "direct",
                        id: f.id,
                        displayName: getDisplayName(f.friend, undefined, {
                          useFullName: true,
                        }),
                        username: f.friend.username,
                        balance: f.balance,
                        currency: f.currency ?? "USD",
                        expenseCount: f.expenseCount,
                        lastExpenseDate: f.lastExpenseDate,
                        friendId: f.friend.id,
                      }}
                      currentUserId={currentUserId}
                      href={`/tabs/${f.id}`}
                      renderActions={() => (
                        <Button
                          size="default"
                          variant="outline"
                          className="shrink-0 hover:text-negative/90"
                          onClick={(e) => handlePoke(f.id, e)}
                        >
                          <PokeIcon className="h-5 w-5 stroke-3 text-negative" />{" "}
                          Poke
                        </Button>
                      )}
                    />
                  </AnimatedCard>
                </motion.div>
              ))}
            </motion.div>
          )}
        </section>
      </div>
    </div>
  );
}
