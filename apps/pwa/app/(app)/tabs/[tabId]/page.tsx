"use client";

import { useEffect, useMemo, useState } from "react";
import useInfiniteScroll from "react-infinite-scroll-hook";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchTab,
  fetchExpenses,
  fetchSettlements,
  fetchBalances,
} from "@/app/actions/queries";
import { authClient } from "@/lib/auth-client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useNavTitle } from "../../context/nav-title-context";
import { SettleUpForm } from "./settle-up-form";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getDisplayName } from "@/lib/display-name";
import { UserAvatar } from "@/components/user-avatar";
import {
  BanknoteArrowUp,
  CircleCheck,
  Settings,
  UserPlus,
  Wallet,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/animations";
import { AnimatedCard } from "@/components/motion/animated-card";

export default function TabPage() {
  const params = useParams<{ tabId: string }>();
  const tabId = params.tabId;
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const setNavTitle = useNavTitle();

  const { data: tab, isLoading: tabLoading } = useQuery({
    queryKey: ["tab", tabId],
    queryFn: () => fetchTab(tabId),
    enabled: !!tabId,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const {
    data: expensesData,
    isLoading: expensesLoading,
    isError: expensesError,
    fetchNextPage: fetchNextExpenses,
    hasNextPage: hasMoreExpenses,
    isFetchingNextPage: isLoadingMoreExpenses,
  } = useInfiniteQuery({
    queryKey: ["expenses", tabId],
    queryFn: ({ pageParam }) =>
      fetchExpenses(tabId, { limit: 50, offset: pageParam }),
    initialPageParam: 0,
    placeholderData: (prev) => prev ?? { pages: [], pageParams: [0] },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || !("total" in lastPage)) return undefined;
      const pages = allPages ?? [];
      const loaded = pages.reduce(
        (sum, p) => sum + (p && "expenses" in p ? (p.expenses?.length ?? 0) : 0),
        0,
      );
      return loaded < (lastPage as { total: number }).total ? loaded : undefined;
    },
    enabled: !!tabId && !!session?.user,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const expenses = expensesData?.pages.flatMap((p) => p?.expenses ?? []) ?? [];

  const { data: settlements, isLoading: settlementsLoading } = useQuery({
    queryKey: ["settlements", tabId],
    queryFn: () => fetchSettlements(tabId),
    enabled: !!tabId,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: balances } = useQuery({
    queryKey: ["balances", tabId],
    queryFn: () => fetchBalances(tabId),
    enabled: !!tabId,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const [settleUpOpen, setSettleUpOpen] = useState(false);

  const [infiniteRef] = useInfiniteScroll({
    loading: isLoadingMoreExpenses,
    hasNextPage: hasMoreExpenses ?? false,
    onLoadMore: fetchNextExpenses,
    rootMargin: "0px 0px 200px 0px",
  });

  function formatAmount(n: number): string {
    return n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  const currentUserId = session?.user?.id ?? "";
  const membersByUserId = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        email: string | null;
        name: string | null;
        username: string | null;
      }
    >();
    for (const m of tab?.members ?? []) {
      map.set(m.userId, m.user);
    }
    return map;
  }, [tab?.members]);
  const getMemberUser = (userId: string) =>
    membersByUserId.get(userId) ?? { id: userId };
  const otherMember = tab?.members?.find(
    (m) => m.userId !== currentUserId,
  )?.user;
  const navTitle = tab
    ? tab.isDirect && otherMember
      ? `Tab with ${getDisplayName(otherMember, currentUserId)}`
      : tab.name
    : "";
  const avatarUserIds = useMemo(
    () =>
      (tab?.members ?? [])
        .filter((m) => m.userId !== currentUserId)
        .map((m) => m.userId),
    [tab?.members, currentUserId],
  );
  const avatarDisplayName =
    tab?.isDirect && otherMember
      ? getDisplayName(otherMember, currentUserId)
      : undefined;
  const isAdmin =
    tab?.members?.find((m) => m.userId === currentUserId)?.role === "owner";

  useEffect(() => {
    if (!tab) return;
    setNavTitle?.({
      title: navTitle,
      backHref: tab.isDirect ? "/friends" : "/tabs",
      avatarUserIds,
      avatarDisplayName,
    });
    return () => setNavTitle?.(null);
  }, [setNavTitle, navTitle, tab, avatarUserIds, avatarDisplayName]);

  if (!tabId) return null;

  if (tabLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center p-4">
        <Spinner />
      </div>
    );
  }

  if (!tab) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 p-4">
        <p className="text-muted-foreground">
          Tab not found or you don&apos;t have access
        </p>
        <Button variant="outline" asChild>
          <Link href="/tabs">Go back</Link>
        </Button>
      </div>
    );
  }

  const youOwe =
    balances?.filter((b) => b.userId === currentUserId && b.amount < 0) ?? [];
  const owedToYou =
    balances?.filter((b) => b.userId === currentUserId && b.amount > 0) ?? [];
  const others = balances?.filter((b) => b.userId !== currentUserId) ?? [];

  const expensesAndSettlements = [
    ...(expenses ?? []).map((e) => ({ ...e, type: "expense" as const })),
    ...(settlements ?? []).map((s) => ({ ...s, type: "settlement" as const })),
  ].sort((a, b) => {
    const dateA = a.type === "expense" ? a.expenseDate : a.createdAt;
    const dateB = b.type === "expense" ? b.expenseDate : b.createdAt;
    return new Date(dateB).getTime() - new Date(dateA).getTime();
  });

  return (
    <div className="p-4">
      <div className="mx-auto max-w-3xl space-y-6 pb-26">
        <div className="flex gap-2 overflow-x-auto overflow-y-hidden -mx-1 px-1 app-scroll-hide">
          {!tab.isDirect && isAdmin && (
            <Button
              variant="secondary"
              className="shrink-0 justify-center gap-2 min-w-28"
              asChild
            >
              <Link href={`/tabs/${tabId}/manage`}>
                <Settings className="h-4 w-4" />
                Manage
              </Link>
            </Button>
          )}
          {!tab.isDirect && avatarUserIds.length > 0 && (
            <Button
              variant="secondary"
              className="shrink-0 justify-center gap-2 min-w-28"
              asChild
            >
              <Link href={`/tabs/${tabId}/members`}>
                <UserPlus className="h-4 w-4" />
                Members
              </Link>
            </Button>
          )}
          <Dialog open={settleUpOpen} onOpenChange={setSettleUpOpen}>
            <DialogTrigger asChild>
              <Button
                variant="positive"
                className="shrink-0 justify-center gap-2 min-w-28"
              >
                <Wallet className="h-4 w-4" />
                Settle
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[90vw] rounded-xl">
              <DialogHeader>
                <DialogTitle>Settle up</DialogTitle>
                <DialogDescription>
                  Record a payment between tab members
                </DialogDescription>
              </DialogHeader>
              <SettleUpForm
                tabId={tabId}
                currentUserId={currentUserId}
                members={tab.members}
                balances={balances ?? []}
                onSuccess={() => setSettleUpOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>

        {!tab.isDirect && avatarUserIds.length === 0 && (
          <div className="rounded-lg border border-border bg-muted/50 p-4">
            <p className="mb-3 text-sm text-muted-foreground">
              Add friends or invite members to this tab to start splitting
              expenses
            </p>
            <Button
              variant="default"
              className="w-full justify-center gap-2"
              asChild
            >
              <Link href={`/tabs/${tabId}/members`}>
                <UserPlus className="h-4 w-4" />
                Invite members
              </Link>
            </Button>
          </div>
        )}
        <section>
          <h2 className="text-base font-medium mb-2">Balances</h2>
          <Card>
            <CardContent className="p-4">
              {!balances || balances.length === 0 ? (
                <p className="text-muted-foreground text-sm">No balances yet</p>
              ) : (
                <div className="space-y-2">
                  {youOwe.map((b) => (
                    <p key={b.userId} className="text-negative text-sm">
                      You owe ${formatAmount(Math.abs(b.amount))}
                    </p>
                  ))}
                  {owedToYou.map((b) => (
                    <p key={b.userId} className="text-positive text-sm">
                      You are owed ${formatAmount(b.amount)}
                    </p>
                  ))}
                  {others.map((b) => (
                    <div
                      key={b.userId}
                      className="flex items-center gap-2 text-muted-foreground text-xs"
                    >
                      <UserAvatar userId={b.userId} size="xs" />
                      <span>
                        {b.amount > 0
                          ? `${getDisplayName(b.user, currentUserId)} is owed $${formatAmount(b.amount)}`
                          : `${getDisplayName(b.user, currentUserId)} owes $${formatAmount(Math.abs(b.amount))}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section>
          <h2 className="text-base font-medium mb-1">Expenses</h2>
          <p className="text-xs text-muted-foreground mb-4">
            All expenses and settlements in this tab
          </p>
          {expensesError ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <p className="text-muted-foreground mb-4">Something went wrong</p>
              <Button
                variant="outline"
                onClick={() => {
                  queryClient.resetQueries({ queryKey: ["expenses", tabId] });
                }}
              >
                Retry
              </Button>
            </div>
          ) : expensesLoading || settlementsLoading ? (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="flex flex-col gap-1 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <Skeleton className="h-5 w-5 shrink-0 rounded" />
                      <Skeleton className="h-4 flex-1 max-w-48" />
                      <Skeleton className="h-4 w-16 shrink-0" />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Skeleton className="h-3 w-14" />
                      <Skeleton className="h-5 w-5 shrink-0 rounded-full" />
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <div className="flex gap-4">
                      <Skeleton className="h-3 w-28" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : expensesAndSettlements.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground text-sm">
              No expenses or settlements yet
            </p>
          ) : (
            <motion.div
              className="flex flex-col gap-4"
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
              {expensesAndSettlements.map((item) =>
                item.type === "expense" ? (
                  <motion.div key={`exp-${item.id}`} variants={staggerItem}>
                    <Link href={`/tabs/${tabId}/expenses/${item.id}`}>
                      <AnimatedCard>
                        <Card className="cursor-pointer hover:bg-muted/50">
                      <CardContent className="flex flex-col gap-1 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <BanknoteArrowUp className="h-5 w-5 shrink-0 text-negative" />
                          <span className="min-w-0 flex-1 font-medium text-sm">
                            {item.description}
                          </span>
                          <span className="text-foreground text-sm shrink-0 font-medium">
                            ${formatAmount(item.amount)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 mb-2">
                          Paid by{" "}
                          <span className="inline-flex items-center gap-1.5">
                            <UserAvatar userId={item.paidById} size="xs" />
                            {getDisplayName(
                              getMemberUser(item.paidById),
                              currentUserId,
                            )}
                          </span>
                          <span>
                            ·{" "}
                            {new Date(item.expenseDate).toLocaleDateString(
                              undefined,
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              },
                            )}
                          </span>
                        </p>
                        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                          {item.splits
                            .filter((s) => s.userId !== item.paidById)
                            .map((s) => {
                              const owesCurrentUser =
                                item.paidById === currentUserId;
                              const currentUserOwes =
                                s.userId === currentUserId;
                              const amountClass = owesCurrentUser
                                ? "text-positive"
                                : currentUserOwes
                                  ? "text-negative"
                                  : "text-muted-foreground";
                              return (
                                <span
                                  key={s.userId}
                                  className="inline-flex items-center gap-1.5"
                                >
                                  <UserAvatar userId={s.userId} size="xs" />
                                  {getDisplayName(
                                    getMemberUser(s.userId),
                                    currentUserId,
                                  )}{" "}
                                  owes{" "}
                                  {getDisplayName(
                                    getMemberUser(item.paidById),
                                    currentUserId,
                                  )}{" "}
                                  <span className={amountClass}>
                                    ${formatAmount(s.amount)}
                                  </span>
                                </span>
                              );
                            })}
                        </div>
                      </CardContent>
                    </Card>
                      </AnimatedCard>
                    </Link>
                  </motion.div>
                ) : (
                  <motion.div key={`set-${item.id}`} variants={staggerItem}>
                    <Link href={`/tabs/${tabId}/settlements/${item.id}`}>
                      <AnimatedCard>
                        <Card className="cursor-pointer hover:bg-muted/50">
                      <CardContent className="flex flex-col gap-1 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <Wallet className="h-5 w-5 shrink-0 text-positive" />
                          <span className="min-w-0 flex-1 font-medium text-sm">
                            {getDisplayName(item.fromUser, currentUserId)} paid{" "}
                            {getDisplayName(item.toUser, currentUserId)}
                          </span>
                          <span className="text-foreground text-sm shrink-0 font-medium">
                            ${formatAmount(item.amount)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="inline-flex items-center gap-1.5">
                            <UserAvatar userId={item.fromUserId} size="xs" />
                            {getDisplayName(item.fromUser, currentUserId)}
                          </span>
                          <span>to</span>
                          <span className="inline-flex items-center gap-1.5">
                            <UserAvatar userId={item.toUserId} size="xs" />
                            {getDisplayName(item.toUser, currentUserId)}
                          </span>
                          <span>
                            ·{" "}
                            {new Date(item.createdAt).toLocaleDateString(
                              undefined,
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              },
                            )}
                          </span>
                        </p>
                      </CardContent>
                    </Card>
                      </AnimatedCard>
                    </Link>
                  </motion.div>
                ),
              )}
              {isLoadingMoreExpenses && (
                <div className="flex flex-col gap-4">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <Card key={i}>
                      <CardContent className="flex flex-col gap-1 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <Skeleton className="h-5 w-5 shrink-0 rounded" />
                          <Skeleton className="h-4 flex-1 max-w-48" />
                          <Skeleton className="h-4 w-16 shrink-0" />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Skeleton className="h-3 w-14" />
                          <Skeleton className="h-5 w-5 shrink-0 rounded-full" />
                          <Skeleton className="h-3 w-20" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
              {hasMoreExpenses && <div ref={infiniteRef} className="h-1" />}
            </motion.div>
          )}
        </section>
      </div>
    </div>
  );
}
