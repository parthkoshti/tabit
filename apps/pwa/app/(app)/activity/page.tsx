"use client";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import useInfiniteScroll from "react-infinite-scroll-hook";
import { fetchActivity } from "@/app/actions/queries";
import type { ActivityItem } from "@/lib/data";
import { authClient } from "@/lib/auth-client";
import { Link as TransitionLink } from "next-view-transitions";
import { ReceiptText } from "lucide-react";
import { getDisplayName } from "@/lib/display-name";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function formatDate(d: Date) {
  const date = new Date(d);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString();
}

function formatAmount(n: number) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function ActivityPage() {
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const currentUserId = session?.user?.id ?? "";

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["activity"],
    queryFn: ({ pageParam }) =>
      fetchActivity({ limit: 50, offset: pageParam }),
    initialPageParam: 0,
    enabled: !!session?.user,
    placeholderData: (prev) =>
      prev ?? { pages: [] as { items: ActivityItem[]; total: number }[], pageParams: [0] },
      getNextPageParam: (lastPage, allPages) => {
        if (!lastPage || !("total" in lastPage)) return undefined;
        const pages = allPages ?? [];
        const loaded = pages.reduce(
          (sum, p) =>
            sum + (p && "items" in p ? (p.items as ActivityItem[]).length : 0),
          0,
        );
        return loaded < (lastPage as { total: number }).total
          ? loaded
          : undefined;
      },
    });

  const items: ActivityItem[] = (data?.pages ?? []).flatMap((p) =>
    p && "items" in p ? (p.items as ActivityItem[]) : [],
  );

  const [infiniteRef] = useInfiniteScroll({
    loading: isFetchingNextPage,
    hasNextPage: hasNextPage ?? false,
    onLoadMore: fetchNextPage,
    rootMargin: "0px 0px 200px 0px",
  });

  return (
    <div className="p-4">
      <div className="mx-auto max-w-2xl space-y-6 pb-26">
        <section className="space-y-4">
          <h2 className="text-base font-medium mb-1">Activity</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Recent expenses and settlements across your tabs
          </p>
          {isError ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <p className="text-muted-foreground mb-4">Something went wrong</p>
              <Button
                variant="outline"
                onClick={() => {
                  queryClient.resetQueries({ queryKey: ["activity"] });
                }}
              >
                Retry
              </Button>
            </div>
          ) : isLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex flex-col gap-2 rounded-xl border border-border bg-card/50 p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                      <Skeleton className="h-4 flex-1 max-w-40" />
                    </div>
                    <Skeleton className="h-4 w-16 shrink-0" />
                  </div>
                  <Skeleton className="h-3 w-48" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))}
            </div>
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
                    href={`/tabs/${item.tabId}/expenses/${item.id}`}
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
                          ${formatAmount(item.amount)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                        {getDisplayName(
                          {
                            id: item.paidById,
                            username: item.paidByUsername,
                            name: item.paidByName,
                            email: item.paidByEmail,
                          },
                          currentUserId,
                        )}{" "}
                        paid in{" "}
                        <span className="inline-flex items-center gap-1 text-foreground">
                          <ReceiptText className="h-3.5 w-3.5 shrink-0 text-tab-icon" />
                          {item.tabName}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(item.expenseDate)}
                      </p>
                    </div>
                  </TransitionLink>
                ) : (
                  <TransitionLink
                    key={`set-${item.id}`}
                    href={`/tabs/${item.tabId}/settlements/${item.id}`}
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
                          ${formatAmount(item.amount)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                        Settlement in{" "}
                        <span className="inline-flex items-center gap-1 text-foreground">
                          <ReceiptText className="h-3.5 w-3.5 shrink-0 text-tab-icon" />
                          {item.tabName}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(item.createdAt)}
                      </p>
                    </div>
                  </TransitionLink>
                ),
              )}
              {isFetchingNextPage && (
                <div className="flex flex-col gap-3">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex flex-col gap-2 rounded-xl border border-border bg-card/50 p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                          <Skeleton className="h-4 flex-1 max-w-40" />
                        </div>
                        <Skeleton className="h-4 w-16 shrink-0" />
                      </div>
                      <Skeleton className="h-3 w-48" />
                    </div>
                  ))}
                </div>
              )}
              {hasNextPage && <div ref={infiniteRef} className="h-1" />}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
