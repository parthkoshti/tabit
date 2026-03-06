"use client";

import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchTabs } from "@/app/actions/queries";
import {
  getPendingTabInviteRequests,
  acceptTabInviteRequest,
  rejectTabInviteRequest,
} from "@/app/actions/tab-invites";
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
  const { data: tabs, isLoading } = useQuery({
    queryKey: ["tabs"],
    queryFn: fetchTabs,
  });
  const { data: tabInvitesData } = useQuery({
    queryKey: ["pendingTabInviteRequests"],
    queryFn: async () => {
      const r = await getPendingTabInviteRequests();
      return r.success ? r.requests : [];
    },
  });
  const pendingTabInvites = tabInvitesData ?? [];

  async function handleAcceptTabInvite(requestId: string) {
    const result = await acceptTabInviteRequest(requestId);
    if (result.success && result.tabId) {
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["tabs"] });
      queryClient.invalidateQueries({ queryKey: ["pendingTabInviteRequests"] });
      router.push(`/app/tabs/${result.tabId}`);
    }
  }

  async function handleRejectTabInvite(requestId: string) {
    await rejectTabInviteRequest(requestId);
    queryClient.invalidateQueries({ queryKey: ["pendingTabInviteRequests"] });
  }

  return (
    <div className="p-4">
      <div className="mx-auto max-w-2xl space-y-6">
        {pendingTabInvites.length > 0 && (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Tab invites</h2>
              <p className="text-sm text-muted-foreground">
                Accept or reject incoming tab invites
              </p>
            </div>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {pendingTabInvites.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-col gap-3 px-4 py-3 transition-colors hover:bg-accent"
                >
                  <div className="flex items-start gap-4">
                    <ReceiptText className="h-6 w-6 shrink-0 text-tab-icon" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">Invite to join {r.tabName}</p>
                      <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <UserAvatar userId={r.fromUserId} size="xs" />
                        <span className="flex flex-col">
                          <span>
                            by{" "}
                            {r.fromUserName ?? r.fromUserUsername ?? "Unknown"}
                          </span>
                          {r.fromUserUsername && (
                            <span>@{r.fromUserUsername}</span>
                          )}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
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
                        onClick={() => handleAcceptTabInvite(r.id)}
                      >
                        Accept
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Your tabs</h2>
            <p className="text-sm text-muted-foreground">
              Create a tab or select one to view
            </p>
          </div>
          {isLoading ? (
            <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
              Loading...
            </p>
          ) : !tabs || tabs.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
              No tabs yet. Use the new tab button above.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {tabs.map((t) => {
                const otherMemberIds =
                  t.memberUserIds?.filter((id) => id !== currentUserId) ?? [];
                const hasExtra = otherMemberIds.length > 3;
                const displayMembers = hasExtra
                  ? otherMemberIds.slice(0, 2)
                  : otherMemberIds.slice(0, 3);
                const extraCount = hasExtra ? otherMemberIds.length - 2 : 0;
                return (
                  <li key={t.id}>
                    <TransitionLink
                      href={`/app/tabs/${t.id}`}
                      className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-accent"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <ReceiptText className="h-5 w-5 shrink-0 text-tab-icon" />
                        <div className="flex min-w-0 flex-col">
                          <span className="font-medium">{t.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(t.createdAt).toLocaleDateString(
                              undefined,
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              }
                            )}
                          </span>
                        </div>
                        {displayMembers.length > 0 && (
                          <div className="flex -space-x-2 shrink-0">
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
                      </div>
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
                    </TransitionLink>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
