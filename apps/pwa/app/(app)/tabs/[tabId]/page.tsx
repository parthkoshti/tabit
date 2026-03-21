import { useEffect, useMemo, useState } from "react";
import useInfiniteScroll from "react-infinite-scroll-hook";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
import { useParams, Link } from "react-router-dom";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BanknoteArrowUp,
  ChevronRight,
  SortDesc,
  UserPlus,
  Wallet,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/animations";
import { AnimatedCard } from "@/components/motion/animated-card";
import { formatAmount } from "@/lib/format-amount";
import { formatAppDate } from "@/lib/format-date";
import { ExpenseReactions } from "@/components/expense-reactions";
import { ExpenseYourBalance } from "@/components/expense-your-balance";

export function TabPage() {
  const { tabId } = useParams<{ tabId: string }>();
  const tabIdOrEmpty = tabId ?? "";
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const currentUserId = session?.user?.id ?? "";
  const setNavTitle = useNavTitle();

  const [expenseFilter, setExpenseFilter] = useState<
    "all" | "involved" | "owed" | "owe" | "settlements"
  >("all");

  const { data: tab, isLoading: tabLoading } = useQuery({
    queryKey: ["tab", tabIdOrEmpty],
    queryFn: async () => {
      const r = await api.tabs.get(tabIdOrEmpty);
      return r.success && r.tab ? r.tab : null;
    },
    enabled: !!tabIdOrEmpty,
  });

  const {
    data: expensesData,
    isLoading: expensesLoading,
    isError: expensesError,
    fetchNextPage: fetchNextExpenses,
    hasNextPage: hasMoreExpenses,
    isFetchingNextPage: isLoadingMoreExpenses,
  } = useInfiniteQuery({
    queryKey: ["expenses", tabIdOrEmpty, expenseFilter],
    queryFn: async ({ pageParam }) => {
      const r = await api.expenses.list(tabIdOrEmpty, {
        limit: 20,
        offset: pageParam,
        filter: expenseFilter === "settlements" ? "all" : expenseFilter,
      });
      return r.success
        ? { expenses: r.expenses ?? [], total: r.total ?? 0 }
        : { expenses: [], total: 0 };
    },
    initialPageParam: 0,
    placeholderData: (prev) => prev ?? { pages: [], pageParams: [0] },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || !("total" in lastPage)) return undefined;
      const pages = allPages ?? [];
      const loaded = pages.reduce(
        (sum, p) =>
          sum + (p && "expenses" in p ? (p.expenses?.length ?? 0) : 0),
        0,
      );
      return loaded < (lastPage as { total: number }).total
        ? loaded
        : undefined;
    },
    enabled:
      !!tabIdOrEmpty && !!session?.user && expenseFilter !== "settlements",
  });
  const rawExpenses = useMemo(() => {
    const flat = expensesData?.pages.flatMap((p) => p?.expenses ?? []) ?? [];
    const seen = new Set<string>();
    return flat.filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
  }, [expensesData]);

  const expenses = useMemo(() => {
    if (expenseFilter === "settlements") return [];
    if (expenseFilter === "all") return rawExpenses;
    return rawExpenses.filter((e) => {
      const isPayer = e.paidById === currentUserId;
      const isInSplits =
        e.splits?.some((s) => s.userId === currentUserId) ?? false;
      if (expenseFilter === "involved") return isPayer || isInSplits;
      if (expenseFilter === "owed") return isPayer;
      if (expenseFilter === "owe") return isInSplits && !isPayer;
      return true;
    });
  }, [rawExpenses, expenseFilter, currentUserId]);

  const { data: settlements, isLoading: settlementsLoading } = useQuery({
    queryKey: ["settlements", tabIdOrEmpty],
    queryFn: async () => {
      const r = await api.settlements.list(tabIdOrEmpty);
      return r.success ? (r.settlements ?? []) : [];
    },
    enabled: !!tabIdOrEmpty,
  });

  const { data: balances } = useQuery({
    queryKey: ["balances", tabIdOrEmpty],
    queryFn: async () => {
      const r = await api.tabs.getBalances(tabIdOrEmpty);
      return r.success ? (r.balances ?? []) : [];
    },
    enabled: !!tabIdOrEmpty,
  });

  const { data: sharedGroupTabs } = useQuery({
    queryKey: ["sharedGroupTabs", tabIdOrEmpty],
    queryFn: async () => {
      const r = await api.tabs.getSharedGroupTabs(tabIdOrEmpty);
      return r.success ? (r.tabs ?? []) : [];
    },
    enabled: !!tabIdOrEmpty && tab?.isDirect === true,
  });

  const [settleUpOpen, setSettleUpOpen] = useState(false);

  const [infiniteRef] = useInfiniteScroll({
    loading: isLoadingMoreExpenses,
    hasNextPage:
      expenseFilter === "settlements" ? false : (hasMoreExpenses ?? false),
    onLoadMore: fetchNextExpenses,
    rootMargin: "0px 0px 200px 0px",
  });

  const tabCurrency = tab?.currency ?? "USD";
  const membersByUserId = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        email: string;
        name: string | null;
        username?: string | null;
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

  const filteredSettlements = useMemo(() => {
    const list = settlements ?? [];
    if (expenseFilter === "owed" || expenseFilter === "owe") return [];
    if (expenseFilter === "settlements") return list;
    if (expenseFilter === "all") return list;
    return list.filter((s) => {
      if (expenseFilter === "involved")
        return s.fromUserId === currentUserId || s.toUserId === currentUserId;
      return true;
    });
  }, [settlements, expenseFilter, currentUserId]);

  const expensesAndSettlements = useMemo(() => {
    return [
      ...(expenses ?? []).map((e) => ({ ...e, type: "expense" as const })),
      ...filteredSettlements.map((s) => ({
        ...s,
        type: "settlement" as const,
      })),
    ].sort((a, b) => {
      const dateA = a.type === "expense" ? a.expenseDate : a.createdAt;
      const dateB = b.type === "expense" ? b.expenseDate : b.createdAt;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
  }, [expenses, filteredSettlements]);

  useEffect(() => {
    if (!tab) return;
    setNavTitle?.({
      title: navTitle,
      backHref: tab.isDirect ? "/friends" : "/tabs",
      avatarUserIds,
      avatarDisplayName,
    });
  }, [setNavTitle, navTitle, tab, avatarUserIds, avatarDisplayName]);

  if (!tabIdOrEmpty) return null;

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
          Tab not found or you don't have access
        </p>
        <Button variant="outline" asChild>
          <Link to="/tabs">Go back</Link>
        </Button>
      </div>
    );
  }

  const youOwe =
    balances?.filter((b) => b.userId === currentUserId && b.amount < 0) ?? [];
  const owedToYou =
    balances?.filter((b) => b.userId === currentUserId && b.amount > 0) ?? [];
  const others = balances?.filter((b) => b.userId !== currentUserId) ?? [];

  return (
    <div className="p-4">
      <div className="mx-auto max-w-3xl space-y-6 pb-60">
        <div className="flex gap-2 overflow-x-auto overflow-y-hidden -mx-1 px-1 app-scroll-hide">
          {!tab.isDirect && avatarUserIds.length > 0 && (
            <Button
              variant="secondary"
              className="shrink-0 justify-center gap-2 min-w-28"
              asChild
            >
              <Link to={`/tabs/${tabIdOrEmpty}/members`}>
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
                tabId={tabIdOrEmpty}
                currentUserId={currentUserId}
                members={tab.members}
                balances={balances ?? []}
                tabCurrency={tabCurrency}
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
              <Link to={`/tabs/${tabIdOrEmpty}/members`}>
                <UserPlus className="h-4 w-4" />
                Invite members
              </Link>
            </Button>
          </div>
        )}
        {tab.isDirect && (sharedGroupTabs?.length ?? 0) > 0 && (
          <section>
            <h2 className="text-base font-medium mb-2">Shared tabs</h2>
            <Card>
              <CardContent className="divide-y divide-border p-0">
                {sharedGroupTabs!.map((st) => {
                  const allMemberIds = st.memberUserIds ?? [];
                  const currentUserFirst =
                    allMemberIds.length > 0
                      ? [
                          currentUserId,
                          ...allMemberIds.filter((id) => id !== currentUserId),
                        ]
                      : [];
                  const hasExtra = currentUserFirst.length > 3;
                  const displayMemberIds = hasExtra
                    ? currentUserFirst.slice(0, 2)
                    : currentUserFirst.slice(0, 3);
                  const extraCount = hasExtra ? currentUserFirst.length - 2 : 0;

                  return (
                    <Link
                      key={st.id}
                      to={`/tabs/${st.id}`}
                      className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/50"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="min-w-0 truncate font-medium">
                          {st.name}
                        </span>
                        {displayMemberIds.length > 0 && (
                          <div className="flex shrink-0 -space-x-2">
                            {displayMemberIds.map((userId) => (
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
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>
                  );
                })}
              </CardContent>
            </Card>
          </section>
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
                      You owe {formatAmount(Math.abs(b.amount), tabCurrency)}
                    </p>
                  ))}
                  {owedToYou.map((b) => (
                    <p key={b.userId} className="text-positive text-sm">
                      You are owed {formatAmount(b.amount, tabCurrency)}
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
                          ? `${getDisplayName(b.user, currentUserId)} is owed ${formatAmount(b.amount, tabCurrency)}`
                          : `${getDisplayName(b.user, currentUserId)} owes ${formatAmount(Math.abs(b.amount), tabCurrency)}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-foreground">
                Expenses
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                All expenses and settlements in this tab
              </p>
            </div>
            <Select
              value={expenseFilter}
              onValueChange={(v) =>
                setExpenseFilter(
                  v as "all" | "involved" | "owed" | "owe" | "settlements",
                )
              }
            >
              <SelectTrigger className="shrink-0 w-fit max-w-34 h-8 text-xs">
                <SortDesc className="h-4 w-4 shrink-0 opacity-70 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="involved">I'm involved</SelectItem>
                <SelectItem value="owed">I'm owed</SelectItem>
                <SelectItem value="owe">I owe</SelectItem>
                <SelectItem value="settlements">Settlements</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {expensesError ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <p className="text-muted-foreground mb-4">Something went wrong</p>
              <Button
                variant="outline"
                onClick={() => {
                  queryClient.resetQueries({
                    queryKey: ["expenses", tabIdOrEmpty, expenseFilter],
                  });
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
              {expenseFilter === "all"
                ? "No expenses or settlements yet"
                : expenseFilter === "settlements"
                  ? "No settlements yet"
                  : "No expenses or settlements match this filter"}
            </p>
          ) : (
            <motion.div
              key={expenseFilter}
              className="flex flex-col gap-4"
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
              {expensesAndSettlements.map((item, i) => {
                const shouldAnimate = i < 8;
                return item.type === "expense" ? (
                  <motion.div
                    key={`exp-${item.id}`}
                    variants={shouldAnimate ? staggerItem : undefined}
                  >
                    <Link to={`/tabs/${tabIdOrEmpty}/expenses/${item.id}`}>
                      <AnimatedCard>
                        <Card
                          className={`cursor-pointer hover:bg-muted/50 ${
                            item.deletedAt ? "opacity-60" : ""
                          }`}
                        >
                          <CardContent className="flex flex-col gap-1 p-4">
                            {tab && !tab.isDirect ? (
                              <>
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex min-w-0 flex-1 items-center gap-2">
                                    <BanknoteArrowUp
                                      className={`h-5 w-5 shrink-0 ${
                                        item.deletedAt
                                          ? "text-muted-foreground"
                                          : "text-negative"
                                      }`}
                                    />
                                    <span
                                      className={`min-w-0 flex-1 font-medium text-sm ${
                                        item.deletedAt
                                          ? "text-muted-foreground"
                                          : ""
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
                                    className={`text-sm shrink-0 font-medium tabular-nums ${
                                      item.deletedAt
                                        ? "text-muted-foreground"
                                        : "text-foreground"
                                    }`}
                                  >
                                    {formatAmount(item.amount, tabCurrency)}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 mb-0">
                                  Paid by{" "}
                                  <span className="inline-flex items-center gap-1.5">
                                    <UserAvatar
                                      userId={item.paidById}
                                      size="xs"
                                    />
                                    {getDisplayName(
                                      getMemberUser(item.paidById),
                                      currentUserId,
                                    )}
                                  </span>
                                </p>
                                <div className="flex items-end justify-between gap-3 pt-0.5">
                                  <p className="text-xs text-muted-foreground min-w-0">
                                    {formatAppDate(item.expenseDate)}
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <ExpenseYourBalance
                                      expenseAmount={item.amount}
                                      tabCurrency={tabCurrency}
                                      paidById={item.paidById}
                                      currentUserId={currentUserId}
                                      yourShare={
                                        item.splits.find(
                                          (s) => s.userId === currentUserId,
                                        )?.amount ?? null
                                      }
                                      deleted={!!item.deletedAt}
                                    />
                                    {!item.deletedAt && (
                                      <ExpenseReactions
                                        expenseId={item.id}
                                        tabId={tabIdOrEmpty}
                                        reactions={item.reactions ?? []}
                                        currentUserId={currentUserId}
                                        compact
                                        getDisplayName={(userId) =>
                                          getDisplayName(
                                            getMemberUser(userId),
                                            currentUserId,
                                          )
                                        }
                                      />
                                    )}
                                  </div>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <BanknoteArrowUp
                                      className={`h-5 w-5 shrink-0 ${
                                        item.deletedAt
                                          ? "text-muted-foreground"
                                          : "text-negative"
                                      }`}
                                    />
                                    <span
                                      className={`min-w-0 flex-1 font-medium text-sm ${
                                        item.deletedAt
                                          ? "text-muted-foreground"
                                          : ""
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
                                    className={`text-sm shrink-0 font-medium ${
                                      item.deletedAt
                                        ? "text-muted-foreground"
                                        : "text-foreground"
                                    }`}
                                  >
                                    {formatAmount(item.amount, tabCurrency)}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 mb-2">
                                  Paid by{" "}
                                  <span className="inline-flex items-center gap-1.5">
                                    <UserAvatar
                                      userId={item.paidById}
                                      size="xs"
                                    />
                                    {getDisplayName(
                                      getMemberUser(item.paidById),
                                      currentUserId,
                                    )}
                                  </span>
                                  <span>
                                    · {formatAppDate(item.expenseDate)}
                                  </span>
                                </p>
                                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-muted-foreground">
                                  <div className="flex flex-wrap gap-x-4 gap-y-2">
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
                                            <UserAvatar
                                              userId={s.userId}
                                              size="xs"
                                            />
                                            {getDisplayName(
                                              getMemberUser(s.userId),
                                              currentUserId,
                                            )}{" "}
                                            {currentUserOwes ? "owe" : "owes"}{" "}
                                            {getDisplayName(
                                              getMemberUser(item.paidById),
                                              currentUserId,
                                            )}{" "}
                                            <span className={amountClass}>
                                              {formatAmount(
                                                s.amount,
                                                tabCurrency,
                                              )}
                                            </span>
                                          </span>
                                        );
                                      })}
                                  </div>
                                  {!item.deletedAt && (
                                    <ExpenseReactions
                                      expenseId={item.id}
                                      tabId={tabIdOrEmpty}
                                      reactions={item.reactions ?? []}
                                      currentUserId={currentUserId}
                                      compact
                                      getDisplayName={(userId) =>
                                        getDisplayName(
                                          getMemberUser(userId),
                                          currentUserId,
                                        )
                                      }
                                    />
                                  )}
                                </div>
                              </>
                            )}
                          </CardContent>
                        </Card>
                      </AnimatedCard>
                    </Link>
                  </motion.div>
                ) : (
                  <motion.div
                    key={`set-${item.id}`}
                    variants={shouldAnimate ? staggerItem : undefined}
                  >
                    <Link to={`/tabs/${tabIdOrEmpty}/settlements/${item.id}`}>
                      <AnimatedCard>
                        <Card className="cursor-pointer hover:bg-muted/50">
                          <CardContent className="flex flex-col gap-1 p-4">
                            <div className="flex items-center justify-between gap-2">
                              <Wallet className="h-5 w-5 shrink-0 text-positive" />
                              <span className="min-w-0 flex-1 font-medium text-sm">
                                {getDisplayName(item.fromUser, currentUserId)}{" "}
                                paid{" "}
                                {getDisplayName(item.toUser, currentUserId)}
                              </span>
                              <span className="text-foreground text-sm shrink-0 font-medium">
                                {formatAmount(item.amount, tabCurrency)}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="inline-flex items-center gap-1.5">
                                <UserAvatar
                                  userId={item.fromUserId}
                                  size="xs"
                                />
                                {getDisplayName(item.fromUser, currentUserId)}
                              </span>
                              <span>to</span>
                              <span className="inline-flex items-center gap-1.5">
                                <UserAvatar userId={item.toUserId} size="xs" />
                                {getDisplayName(item.toUser, currentUserId)}
                              </span>
                              <span>· {formatAppDate(item.createdAt)}</span>
                            </p>
                          </CardContent>
                        </Card>
                      </AnimatedCard>
                    </Link>
                  </motion.div>
                );
              })}
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
