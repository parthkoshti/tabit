import { useEffect, useMemo, useState } from "react";
import useInfiniteScroll from "react-infinite-scroll-hook";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
import { useParams, Link } from "@/lib/navigation";
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
import { ChevronRight, SortDesc, UserPlus, Wallet } from "lucide-react";
import { TabPageSkeleton, ExpenseListSkeleton } from "@/components/page-skeletons";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/animations";
import { AnimatedCard } from "@/components/motion/animated-card";
import { formatAmount } from "@/lib/format-amount";
import { TabExpenseCard } from "@/components/tab-expense-card";
import type { Expense } from "@/lib/domain-types";
import { TabSettlementCard } from "@/components/tab-settlement-card";
import { PaymentReminderDialog } from "@/components/payment-reminder-dialog";

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

  const { data: tab, isPending: tabPending } = useQuery({
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
  const [remindOpen, setRemindOpen] = useState(false);

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
  const currentUserParticipantId = useMemo(
    () =>
      tab?.participants?.find((p) => p.userId === currentUserId)?.id ?? null,
    [tab?.participants, currentUserId],
  );
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
      if (expenseFilter === "involved") {
        if (s.fromUserId === currentUserId || s.toUserId === currentUserId) {
          return true;
        }
        if (
          currentUserParticipantId &&
          (s.fromParticipantId === currentUserParticipantId ||
            s.toParticipantId === currentUserParticipantId)
        ) {
          return true;
        }
        return false;
      }
      return true;
    });
  }, [settlements, expenseFilter, currentUserId, currentUserParticipantId]);

  const expensesAndSettlements = useMemo(() => {
    return [
      ...(expenses ?? []).map((e) => ({ ...e, type: "expense" as const })),
      ...filteredSettlements.map((s) => ({
        ...s,
        type: "settlement" as const,
      })),
    ].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
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

  if (tabPending) {
    return <TabPageSkeleton />;
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

  const otherMemberUserId =
    tab.members.find((m) => m.userId !== currentUserId)?.userId ?? "";
  const friendDisplayName = otherMember
    ? getDisplayName(otherMember, currentUserId)
    : "Friend";

  let directMyNet = 0;
  if (tab.isDirect && balances && balances.length > 0) {
    const mine = balances.find((b) => b.userId === currentUserId);
    if (mine !== undefined) {
      directMyNet = mine.amount;
    } else {
      const otherRows = balances.filter((b) => b.userId !== currentUserId);
      if (otherRows.length === 1 && tab.members.length === 2) {
        directMyNet = -otherRows[0].amount;
      }
    }
  }

  return (
    <div className="p-4">
      <div className="mx-auto max-w-3xl space-y-6">
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
                participants={tab.participants ?? []}
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
                  const sharedBalance = st.balance ?? 0;
                  const sharedCurrency = st.currency ?? "USD";
                  const sharedBalanceText =
                    sharedBalance > 0
                      ? `You're owed ${formatAmount(sharedBalance, sharedCurrency)}`
                      : sharedBalance < 0
                        ? `You owe ${formatAmount(Math.abs(sharedBalance), sharedCurrency)}`
                        : "Settled";

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
                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className={
                            sharedBalance > 0
                              ? "max-w-36 truncate text-right text-xs font-medium text-positive"
                              : sharedBalance < 0
                                ? "max-w-36 truncate text-right text-xs font-medium text-negative"
                                : "max-w-36 truncate text-right text-xs text-muted-foreground"
                          }
                        >
                          {sharedBalanceText}
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </div>
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
              ) : tab.isDirect ? (
                <div className="flex items-center gap-4 text-sm justify-between">
                  {directMyNet > 0 ? (
                    <>
                      <div className="flex items-center gap-2 flex-wrap">
                        <UserAvatar
                          userId={otherMemberUserId}
                          size="sm"
                          className="shrink-0"
                        />
                        <span className="min-w-0">
                          <span className="text-foreground">
                            {friendDisplayName}
                          </span>{" "}
                          <span className="text-muted-foreground">
                            owes you
                          </span>{" "}
                          <span className="font-medium text-positive tabular-nums">
                            {formatAmount(directMyNet, tabCurrency)}
                          </span>
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 w-fit"
                        onClick={() => setRemindOpen(true)}
                      >
                        Remind
                      </Button>
                    </>
                  ) : directMyNet < 0 ? (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="shrink-0 text-muted-foreground">
                        You owe
                      </span>
                      <UserAvatar
                        userId={otherMemberUserId}
                        size="sm"
                        className="shrink-0"
                      />
                      <span className="min-w-0">
                        <span className="font-medium">{friendDisplayName}</span>{" "}
                        <span className="font-medium tabular-nums text-negative">
                          {formatAmount(Math.abs(directMyNet), tabCurrency)}
                        </span>
                      </span>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Settled up</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {youOwe.map((b) => (
                    <p key={b.participantId} className="text-negative text-sm">
                      You owe {formatAmount(Math.abs(b.amount), tabCurrency)}
                    </p>
                  ))}
                  {owedToYou.map((b) => (
                    <p key={b.participantId} className="text-positive text-sm">
                      You are owed {formatAmount(b.amount, tabCurrency)}
                    </p>
                  ))}
                  {others.map((b) => (
                    <div
                      key={b.participantId}
                      className="flex items-center gap-2 text-muted-foreground text-xs"
                    >
                      <UserAvatar userId={b.user.id} size="xs" />
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

        {tab.isDirect && (
          <PaymentReminderDialog
            open={remindOpen}
            onOpenChange={setRemindOpen}
            friendTabId={tabIdOrEmpty}
            friendDisplayName={friendDisplayName}
            senderLabel={session?.user?.name?.trim() || "You"}
            amountDisplay={formatAmount(Math.max(0, directMyNet), tabCurrency)}
          />
        )}

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
            <ExpenseListSkeleton />
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
                        <TabExpenseCard
                          expense={item as unknown as Expense}
                          tabCurrency={tabCurrency}
                          tabId={tabIdOrEmpty}
                          isDirect={!!tab?.isDirect}
                          currentUserId={currentUserId}
                          currentUserParticipantId={currentUserParticipantId}
                          getMemberUser={getMemberUser}
                        />
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
                        <TabSettlementCard
                          settlement={item}
                          tabCurrency={tabCurrency}
                          currentUserId={currentUserId}
                        />
                      </AnimatedCard>
                    </Link>
                  </motion.div>
                );
              })}
              {isLoadingMoreExpenses && <ExpenseListSkeleton count={2} />}
              {hasMoreExpenses && <div ref={infiniteRef} className="h-1" />}
            </motion.div>
          )}
        </section>
      </div>
    </div>
  );
}
