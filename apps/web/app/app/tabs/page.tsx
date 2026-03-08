"use client";

import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Link as TransitionLink } from "next-view-transitions";
import { ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { authClient } from "@/lib/auth-client";

export default function TabsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const currentUserId = session?.user?.id ?? "";
  type TabItem = { id: string; name: string; balance?: number; memberUserIds?: string[]; expenseCount?: number; lastExpenseDate?: string | null };
  type TabInviteItem = { id: string; tabId: string; fromUserId: string; tabName: string; fromUserName: string | null; fromUserUsername: string | null; createdAt: string };

  const { data: tabsData, isLoading } = useQuery({
    queryKey: ["tabs"],
    queryFn: async () => {
      const r = await api.tabs.list();
      return (r.success ? r.tabs : []) as TabItem[];
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const tabs = tabsData ?? [];
  const { data: tabInvitesData } = useQuery({
    queryKey: ["pendingTabInviteRequests"],
    queryFn: async () => {
      const r = await api.tabInvites.getPendingRequests();
      return (r.success ? r.requests : []) as TabInviteItem[];
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const pendingTabInvites = tabInvitesData ?? [];

  async function handleAcceptTabInvite(requestId: string) {
    const result = await api.tabInvites.acceptRequest(requestId);
    if (result.success && result.tabId) {
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["tabs"] });
      queryClient.invalidateQueries({ queryKey: ["pendingTabInviteRequests"] });
      router.push(`/app/tabs/${result.tabId}`);
    }
  }

  async function handleRejectTabInvite(requestId: string) {
    await api.tabInvites.rejectRequest(requestId);
    queryClient.invalidateQueries({ queryKey: ["pendingTabInviteRequests"] });
  }

  return (
    <div className="p-4">
      <div className="mx-auto max-w-2xl space-y-6">
        {pendingTabInvites.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-base font-medium mb-1">Tab invites</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Accept or reject incoming tab invites
            </p>
            <div className="flex flex-col gap-3">
              {pendingTabInvites.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-card/50 p-4"
                >
                  <div className="flex items-start gap-3">
                    <ReceiptText className="h-5 w-5 shrink-0 text-tab-icon mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">Invite to join {r.tabName}</p>
                      <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <UserAvatar userId={r.fromUserId} size="xs" />
                        <span>
                          by {r.fromUserName ?? r.fromUserUsername ?? "Unknown"}
                          {r.fromUserUsername && (
                            <span className="ml-0.5">
                              @{r.fromUserUsername}
                            </span>
                          )}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => handleRejectTabInvite(r.id)}
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="positive"
                        onClick={() => handleAcceptTabInvite(r.id)}
                      >
                        Accept
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-4">
          <h2 className="text-base font-medium mb-1">Your tabs</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Create a tab or tap to view
          </p>
          {isLoading ? (
            <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
              Loading...
            </p>
          ) : !tabs || tabs.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
              No tabs yet. Use the new tab button above.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {tabs.map((t) => {
                const otherMemberIds =
                  t.memberUserIds?.filter((id) => id !== currentUserId) ?? [];
                const hasExtra = otherMemberIds.length > 3;
                const displayMembers = hasExtra
                  ? otherMemberIds.slice(0, 2)
                  : otherMemberIds.slice(0, 3);
                const extraCount = hasExtra ? otherMemberIds.length - 2 : 0;
                return (
                  <TransitionLink key={t.id} href={`/app/tabs/${t.id}`}>
                    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card/50 p-4 transition-colors hover:bg-muted/50 hover:border-border/80">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium">{t.name}</span>
                        <span
                          className={
                            (t.balance ?? 0) > 0
                              ? "text-sm font-medium text-positive shrink-0"
                              : (t.balance ?? 0) < 0
                                ? "text-sm font-medium text-negative shrink-0"
                                : "text-sm text-muted-foreground shrink-0"
                          }
                        >
                          {(t.balance ?? 0) > 0
                            ? `+$${(t.balance ?? 0).toFixed(2)}`
                            : (t.balance ?? 0) < 0
                              ? `-$${Math.abs(t.balance ?? 0).toFixed(2)}`
                              : "Settled"}
                        </span>
                      </div>
                      {displayMembers.length > 0 && (
                        <div className="flex -space-x-2">
                          {displayMembers.map((userId) => (
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
                      <span className="text-xs text-muted-foreground">
                        {(t.expenseCount ?? 0) === 0
                          ? "No expenses yet"
                          : `${t.expenseCount} expense${(t.expenseCount ?? 0) === 1 ? "" : "s"}`}
                        {t.lastExpenseDate && (
                          <>
                            {" "}
                            &middot;{" "}
                            {new Date(t.lastExpenseDate).toLocaleDateString(
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
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
