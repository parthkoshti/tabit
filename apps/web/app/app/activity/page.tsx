"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchActivity } from "@/app/actions/queries";
import { authClient } from "@/lib/auth-client";
import { Link as TransitionLink } from "next-view-transitions";
import { getDisplayName } from "@/lib/display-name";
import { UserAvatar } from "@/components/user-avatar";

function formatDate(d: Date) {
  const date = new Date(d);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString();
}

export default function ActivityPage() {
  const { data: session } = authClient.useSession();
  const currentUserId = session?.user?.id ?? "";
  const { data: items, isLoading } = useQuery({
    queryKey: ["activity"],
    queryFn: fetchActivity,
  });

  return (
    <div className="p-4">
      <div className="mx-auto max-w-2xl space-y-6 pb-26">
        <section className="space-y-4">
          <h2 className="text-base font-medium mb-1">Activity</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Recent expenses and settlements across your tabs
          </p>
          {isLoading ? (
            <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
              Loading...
            </p>
          ) : !items || items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
              No activity yet
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {items.map((item) =>
                item.type === "expense" ? (
                  <TransitionLink
                    key={`exp-${item.id}`}
                    href={`/app/tabs/${item.tabId}`}
                  >
                    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card/50 p-4 transition-colors hover:bg-muted/50 hover:border-border/80">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <UserAvatar userId={item.paidById} size="sm" />
                          <span className="font-medium truncate">
                            {item.description}
                          </span>
                        </div>
                        <span className="text-sm font-medium shrink-0">
                          ${item.amount.toFixed(2)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {getDisplayName(
                          {
                            id: item.paidById,
                            username: item.paidByUsername,
                            name: item.paidByName,
                            email: item.paidByEmail,
                          },
                          currentUserId,
                        )}{" "}
                        paid in {item.tabName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(item.expenseDate)}
                      </p>
                    </div>
                  </TransitionLink>
                ) : (
                  <TransitionLink
                    key={`set-${item.id}`}
                    href={`/app/tabs/${item.tabId}`}
                  >
                    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card/50 p-4 transition-colors hover:bg-muted/50 hover:border-border/80">
                      <div className="flex items-center gap-2">
                        <UserAvatar userId={item.fromUserId} size="sm" />
                        <span className="font-medium">
                          {getDisplayName(
                            {
                              id: item.fromUserId,
                              username: item.fromUserUsername,
                              name: item.fromUserName,
                              email: item.fromUserEmail,
                            },
                            currentUserId,
                          )}{" "}
                          paid{" "}
                          {getDisplayName(
                            {
                              id: item.toUserId,
                              username: item.toUserUsername,
                              name: item.toUserName,
                              email: item.toUserEmail,
                            },
                            currentUserId,
                          )}{" "}
                          ${item.amount.toFixed(2)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Settlement in {item.tabName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(item.createdAt)}
                      </p>
                    </div>
                  </TransitionLink>
                ),
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
