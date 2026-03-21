import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import useInfiniteScroll from "react-infinite-scroll-hook";
import { api } from "@/lib/api-client";
import type { ActivityItem } from "data";
import { authClient } from "@/lib/auth-client";
import { Link } from "react-router-dom";
import { ReceiptText } from "lucide-react";
import { getDisplayName } from "@/lib/display-name";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/animations";
import { AnimatedCard } from "@/components/motion/animated-card";
import { useMemo } from "react";
import { formatAmount } from "@/lib/format-amount";
import { cn } from "@/lib/utils";
import { ExpenseYourBalance } from "@/components/expense-your-balance";
import { formatAppDate } from "@/lib/format-date";

export function ActivityPage() {
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
    queryFn: async ({ pageParam }) => {
      const r = await api.activity.list({ limit: 50, offset: pageParam });
      return r.success
        ? { items: r.items ?? [], total: r.total ?? 0 }
        : { items: [], total: 0 };
    },
    initialPageParam: 0,
    enabled: !!session?.user,
    placeholderData: (prev) =>
      prev ?? {
        pages: [] as { items: ActivityItem[]; total: number }[],
        pageParams: [0],
      },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || typeof lastPage !== "object" || !("total" in lastPage))
        return undefined;
      const pages = allPages ?? [];
      const loaded = pages.reduce(
        (sum, p) =>
          sum +
          (p && typeof p === "object" && "items" in p
            ? (p.items as ActivityItem[]).length
            : 0),
        0,
      );
      return loaded < (lastPage as { total: number }).total
        ? loaded
        : undefined;
    },
  });

  const items = useMemo((): ActivityItem[] => {
    const flat = (data?.pages ?? []).flatMap((p) =>
      p && typeof p === "object" && "items" in p
        ? (p.items as ActivityItem[])
        : [],
    );
    const seen = new Set<string>();
    return flat.filter((item) => {
      const k = `${item.type}:${item.id}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [data]);

  const [infiniteRef] = useInfiniteScroll({
    loading: isFetchingNextPage,
    hasNextPage: hasNextPage ?? false,
    onLoadMore: fetchNextPage,
    rootMargin: "0px 0px 200px 0px",
  });

  return (
    <div className="p-4">
      <div className="mx-auto max-w-2xl space-y-6 pb-60">
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
                    <div className="flex flex-1 items-center gap-2">
                      <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                      <Skeleton className="h-4 flex-1 max-w-40" />
                    </div>
                    <Skeleton className="h-4 w-14 shrink-0" />
                  </div>
                  <Skeleton className="h-3 w-48" />
                  <div className="flex items-end justify-between gap-3 pt-0.5">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-10 w-20 shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          ) : !items || items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
              No activity yet
            </p>
          ) : (
            <motion.div
              className="flex flex-col gap-3"
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
              {items.map((item, i) => {
                const shouldAnimate = i < 8;
                return item.type === "expense" ? (
                  <motion.div
                    key={`exp-${item.id}`}
                    variants={shouldAnimate ? staggerItem : undefined}
                  >
                    <Link to={`/tabs/${item.tabId}/expenses/${item.id}`}>
                      <AnimatedCard
                        className={`flex flex-col gap-2 rounded-xl border border-border bg-card/50 p-4 hover:bg-muted/50 hover:border-border/80 ${
                          item.deletedAt ? "opacity-60" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 min-w-0">
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <UserAvatar userId={item.paidById} size="sm" />
                            <span
                              className={`font-medium truncate min-w-0 ${
                                item.deletedAt ? "text-muted-foreground" : ""
                              }`}
                            >
                              {item.description}
                            </span>
                            {item.deletedAt && (
                              <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                Deleted
                              </span>
                            )}
                          </div>
                          <span
                            className={cn(
                              "text-sm font-medium shrink-0 tabular-nums",
                              item.deletedAt && "text-muted-foreground",
                            )}
                          >
                            {formatAmount(item.amount, item.tabCurrency)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                          {getDisplayName(
                            {
                              id: item.paidById,
                              username: item.paidByUsername,
                              name: item.paidByName,
                              email: item.paidByEmail,
                            },
                            currentUserId,
                          )}{" "}
                          paid{" "}
                          {item.tabIsDirect && item.directOtherUser ? (
                            item.paidById === currentUserId &&
                            (item.yourShare == null ||
                              item.yourShare <= 0.001) ? (
                              <>
                                —{" "}
                                <span className="text-foreground">
                                  {getDisplayName(
                                    item.directOtherUser,
                                    currentUserId,
                                  )}
                                </span>{" "}
                                owes you{" "}
                                <span className="text-foreground font-medium">
                                  {formatAmount(
                                    item.amount - (item.yourShare ?? 0),
                                    item.tabCurrency,
                                  )}
                                </span>
                              </>
                            ) : (
                              <>
                                — You split with{" "}
                                <span className="text-foreground">
                                  {getDisplayName(
                                    item.directOtherUser,
                                    currentUserId,
                                  )}
                                </span>
                              </>
                            )
                          ) : (
                            <>
                              in{" "}
                              <span className="inline-flex items-center gap-1 text-foreground">
                                <ReceiptText className="h-3.5 w-3.5 shrink-0 text-tab-icon" />
                                {item.tabName}
                              </span>
                            </>
                          )}
                        </p>
                        <div className="flex items-end justify-between gap-3 pt-0.5">
                          <p className="text-xs text-muted-foreground min-w-0">
                            {formatAppDate(item.expenseDate)}
                          </p>
                          <ExpenseYourBalance
                            expenseAmount={item.amount}
                            tabCurrency={item.tabCurrency}
                            paidById={item.paidById}
                            currentUserId={currentUserId}
                            yourShare={item.yourShare}
                            deleted={!!item.deletedAt}
                          />
                        </div>
                      </AnimatedCard>
                    </Link>
                  </motion.div>
                ) : (
                  <motion.div
                    key={`set-${item.id}`}
                    variants={shouldAnimate ? staggerItem : undefined}
                  >
                    <Link to={`/tabs/${item.tabId}/settlements/${item.id}`}>
                      <AnimatedCard className="flex flex-col gap-2 rounded-xl border border-border bg-card/50 p-4 hover:bg-muted/50 hover:border-border/80">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <UserAvatar userId={item.fromUserId} size="sm" />
                            <span className="font-medium truncate">
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
                              )}
                            </span>
                          </div>
                          <span className="text-sm font-medium shrink-0">
                            {formatAmount(item.amount, item.tabCurrency)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5 flex-wrap">
                          Settlement{" "}
                          {item.tabIsDirect && item.directOtherUser ? (
                            <>
                              — You split with{" "}
                              <span className="text-foreground">
                                {getDisplayName(
                                  item.directOtherUser,
                                  currentUserId,
                                )}
                              </span>
                            </>
                          ) : (
                            <>
                              in{" "}
                              <span className="inline-flex items-center gap-1 text-foreground">
                                <ReceiptText className="h-3.5 w-3.5 shrink-0 text-tab-icon" />
                                {item.tabName}
                              </span>
                            </>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatAppDate(item.createdAt)}
                        </p>
                      </AnimatedCard>
                    </Link>
                  </motion.div>
                );
              })}
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
            </motion.div>
          )}
        </section>
      </div>
    </div>
  );
}
