"use client";

import { useDeferredValue, useRef, useState } from "react";
import { usePathname, useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchFriends, fetchTabs, fetchTab } from "@/app/actions/queries";
import { authClient } from "@/lib/auth-client";
import { AddExpenseForm } from "../tabs/[tabId]/add-expense-form";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getDisplayName } from "@/lib/display-name";
import { UserAvatar } from "@/components/user-avatar";
import Link from "next/link";
import { createStore, clear } from "idb-keyval";
import {
  ArrowLeft,
  CornerDownLeft,
  Loader2,
  Plus,
  ReceiptText,
  RefreshCw,
  Sparkles,
  User,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { fabSpring } from "@/lib/animations";
import { ExpenseAddedToast } from "@/components/expense-added-toast";

type Member = {
  userId: string;
  role: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    username?: string | null;
  };
};

function buildMembersFromFriend(
  currentUser: {
    id: string;
    email: string;
    name: string | null;
    username?: string | null;
  },
  friend: {
    id: string;
    email: string;
    name: string | null;
    username?: string | null;
  },
): Member[] {
  return [
    {
      userId: currentUser.id,
      role: "member",
      user: {
        id: currentUser.id,
        email: currentUser.email,
        name: currentUser.name,
        username: currentUser.username,
      },
    },
    {
      userId: friend.id,
      role: "member",
      user: {
        id: friend.id,
        email: friend.email,
        name: friend.name,
        username: friend.username,
      },
    },
  ];
}

function isFabVisible(pathname: string): boolean {
  if (pathname === "/friends") return true;
  if (pathname === "/tabs") return true;
  if (pathname === "/activity") return true;
  if (/^\/tabs\/[^/]+$/.test(pathname)) return true;
  return false;
}

export function AddExpenseFAB() {
  const pathname = usePathname();
  const deferredPathname = useDeferredValue(pathname);
  const params = useParams<{ tabId?: string }>();
  const tabIdFromParams = params?.tabId;
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const currentUserId = session?.user?.id ?? "";

  const [open, setOpen] = useState(false);
  const [addExpenseMode, setAddExpenseMode] = useState<"tab" | "direct">("tab");
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [selectedTabId, setSelectedTabId] = useState<string | null>(null);
  const [pickedAnotherTab, setPickedAnotherTab] = useState(false);

  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiInputText, setAiInputText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const aiFormRef = useRef<HTMLFormElement>(null);

  const { data: friends, isLoading: friendsLoading } = useQuery({
    queryKey: ["friends"],
    queryFn: fetchFriends,
    enabled: open,
    staleTime: 0,
  });

  const { data: tabs, isLoading: tabsLoading } = useQuery({
    queryKey: ["tabs"],
    queryFn: fetchTabs,
    enabled: open,
    staleTime: 0,
  });

  const effectiveTabId =
    addExpenseMode === "tab"
      ? (selectedTabId ??
        (tabIdFromParams && !pickedAnotherTab ? tabIdFromParams : null))
      : addExpenseMode === "direct"
        ? selectedFriendId
        : null;

  const { data: tab, isLoading: tabLoading } = useQuery({
    queryKey: ["tab", effectiveTabId],
    queryFn: () => fetchTab(effectiveTabId!),
    enabled:
      open &&
      addExpenseMode === "tab" &&
      !!effectiveTabId,
    staleTime: 0,
  });

  const handleOpenChange = (next: boolean) => {
    if (next) {
      const isFriendsRoute = deferredPathname === "/friends";
      setAddExpenseMode(isFriendsRoute ? "direct" : "tab");
      setPickedAnotherTab(false);
      if (isFriendsRoute) {
        setSelectedFriendId(null);
        setSelectedTabId(null);
      } else {
        setSelectedTabId(tabIdFromParams ?? null);
        setSelectedFriendId(null);
      }
    } else {
      setSelectedFriendId(null);
      setSelectedTabId(null);
      setPickedAnotherTab(false);
    }
    setOpen(next);
  };

  const handleExpenseSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["friends"] });
    queryClient.invalidateQueries({ queryKey: ["tabs"] });
    handleOpenChange(false);
  };

  if (!isFabVisible(deferredPathname)) return null;

  const bustCache = async () => {
    queryClient.clear();
    const idbStore = createStore("tabit-query-cache", "queries");
    await clear(idbStore);
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
    }
    localStorage.clear();
    window.location.reload();
  };

  return (
    <div className="fixed bottom-28 right-4 z-30 flex flex-col items-end gap-2">
      {process.env.NODE_ENV === "development" && (
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-full text-muted-foreground"
          onClick={bustCache}
          title="Bust query cache"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      )}
      <motion.div {...fabSpring} whileTap={{ scale: 0.95 }}>
        <Button
          variant="default"
          className="h-12 gap-2 rounded-full px-4 shadow-lg"
          onClick={() => {
            setAiError(null);
            setAiInputText("");
            setAiDialogOpen(true);
          }}
        >
          <Sparkles className="h-4 w-4" />
          AI Add expense
        </Button>
      </motion.div>
      <motion.div {...fabSpring} whileTap={{ scale: 0.95 }}>
        <Button
          variant="outline"
          className="h-12 gap-2 rounded-full px-4 shadow-lg"
          onClick={() => setOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Expense
        </Button>
      </motion.div>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-[90vw] rounded-xl">
          <DialogHeader>
            <DialogTitle>Add expense</DialogTitle>
            <DialogDescription>
              Add an expense to a tab or split with a friend
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2">
            <Button
              type="button"
              variant={addExpenseMode === "tab" ? "default" : "outline"}
              size="sm"
              className="flex-1 gap-2"
              onClick={() => {
                setAddExpenseMode("tab");
                setSelectedFriendId(null);
                setPickedAnotherTab(false);
                setSelectedTabId(tabIdFromParams ?? null);
              }}
            >
              <ReceiptText className="h-4 w-4" />
              Tab
            </Button>
            <Button
              type="button"
              variant={addExpenseMode === "direct" ? "default" : "outline"}
              size="sm"
              className="flex-1 gap-2"
              onClick={() => {
                setAddExpenseMode("direct");
                setSelectedTabId(null);
                setSelectedFriendId(null);
              }}
            >
              <User className="h-4 w-4" />
              Direct
            </Button>
          </div>

          {addExpenseMode === "direct" && (
            <>
              {!selectedFriendId ? (
                <>
                  {friendsLoading ? (
                    <div className="flex justify-center py-8">
                      <Spinner />
                    </div>
                  ) : !friends || friends.length === 0 ? (
                    <div className="space-y-4 py-4">
                      <p className="text-sm text-muted-foreground">
                        No friends yet. Add a friend first.
                      </p>
                      <Button asChild variant="outline" className="w-full">
                        <Link href="/friends/addFriend">Add friend</Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
                      {friends.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setSelectedFriendId(f.id)}
                          className="flex flex-col gap-2 rounded-xl border border-border bg-card/50 p-4 text-left transition-colors hover:bg-muted/50 hover:border-border/80"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-3">
                              <UserAvatar
                                userId={f.friend.id}
                                size="sm"
                                className="shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-medium">
                                  {getDisplayName(f.friend)}
                                </div>
                                {f.friend.username && (
                                  <div className="truncate text-sm text-muted-foreground">
                                    @{f.friend.username}
                                  </div>
                                )}
                              </div>
                            </div>
                            <span
                              className={
                                f.balance > 0
                                  ? "shrink-0 text-sm font-medium text-positive"
                                  : f.balance < 0
                                    ? "shrink-0 text-sm text-negative"
                                    : "shrink-0 text-sm text-muted-foreground"
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
                                  },
                                )}
                              </>
                            )}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                (() => {
                  const friend = friends?.find(
                    (f) => f.id === selectedFriendId,
                  );
                  if (!friend || !session?.user) return null;
                  const members = buildMembersFromFriend(
                    session.user,
                    friend.friend,
                  );
                  return (
                    <div className="space-y-4">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="-ml-2"
                        onClick={() => setSelectedFriendId(null)}
                      >
                        <ArrowLeft /> Pick another friend
                      </Button>
                      <AddExpenseForm
                        tabId={selectedFriendId}
                        members={members}
                        currentUserId={currentUserId}
                        onSuccess={handleExpenseSuccess}
                      />
                    </div>
                  );
                })()
              )}
            </>
          )}

          {addExpenseMode === "tab" && (
            <>
              {!effectiveTabId ? (
                <>
                  {tabsLoading ? (
                    <div className="flex justify-center py-8">
                      <Spinner />
                    </div>
                  ) : !tabs || tabs.length === 0 ? (
                    <div className="space-y-4 py-4">
                      <p className="text-sm text-muted-foreground">
                        No tabs yet. Create a tab first.
                      </p>
                      <Button asChild variant="outline" className="w-full">
                        <Link href="/tabs/create">Create tab</Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
                      {tabs.map((t) => {
                        const otherMemberIds =
                          t.memberUserIds?.filter(
                            (id) => id !== currentUserId,
                          ) ?? [];
                        const hasExtra = otherMemberIds.length > 3;
                        const displayMembers = hasExtra
                          ? otherMemberIds.slice(0, 2)
                          : otherMemberIds.slice(0, 3);
                        const extraCount = hasExtra
                          ? otherMemberIds.length - 2
                          : 0;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setSelectedTabId(t.id)}
                            className="flex flex-col gap-2 rounded-xl border border-border bg-card/50 p-4 text-left transition-colors hover:bg-muted/50 hover:border-border/80"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-medium text-sm">
                                {t.name}
                              </span>
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
                                  {new Date(
                                    t.lastExpenseDate,
                                  ).toLocaleDateString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                </>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {tabLoading ? (
                    <div className="flex justify-center py-8">
                      <Spinner />
                    </div>
                  ) : !tab ? (
                    <p className="text-sm text-muted-foreground">
                      Tab not found
                    </p>
                  ) : tab.members.length < 2 ? (
                    <div className="space-y-4 py-4">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="-ml-2"
                        onClick={() => {
                          setPickedAnotherTab(true);
                          setSelectedTabId(null);
                        }}
                      >
                        <ArrowLeft /> Pick another tab
                      </Button>
                      <p className="text-sm text-muted-foreground">
                        Add members to this tab to start splitting expenses.
                      </p>
                      <Button asChild variant="outline" className="w-full">
                        <Link href={`/tabs/${effectiveTabId}/members`}>
                          Invite members
                        </Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="-ml-2"
                        onClick={() => {
                          setPickedAnotherTab(true);
                          setSelectedTabId(null);
                        }}
                      >
                        <ArrowLeft /> Pick another tab
                      </Button>
                      <AddExpenseForm
                        tabId={effectiveTabId}
                        members={tab.members}
                        currentUserId={currentUserId}
                        onSuccess={handleExpenseSuccess}
                      />
                    </div>
                  )}
                </>
              )}
            </>
          )}

        </DialogContent>
      </Dialog>

      <Dialog
        open={aiDialogOpen}
        onOpenChange={(next) => {
          if (!next) setAiError(null);
          setAiDialogOpen(next);
        }}
      >
        <DialogContent className="max-w-[90vw] rounded-xl">
          <DialogHeader>
            <DialogTitle>AI Add expense</DialogTitle>
            <DialogDescription>
              Describe the expense in natural language. Include the amount,
              description, and who it's with
            </DialogDescription>
          </DialogHeader>
          <form
            ref={aiFormRef}
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const text = aiInputText.trim();
              if (!text || aiLoading) return;
              setAiLoading(true);
              setAiError(null);
              const result = await api.ai.addExpense({ text });
              setAiLoading(false);
              if (
                result.success &&
                result.expenseId &&
                result.tabId &&
                result.amount != null &&
                result.description &&
                result.tabName
              ) {
                const { expenseId, tabId } = result;
                toast.info(
                  <ExpenseAddedToast
                    expenseId={expenseId}
                    tabId={tabId}
                    amount={result.amount}
                    description={result.description}
                    tabName={result.tabName}
                    participants={result.participants ?? []}
                    currentUserId={currentUserId}
                  />,
                  { duration: 10_000 },
                );
                queryClient.invalidateQueries({ queryKey: ["friends"] });
                queryClient.invalidateQueries({ queryKey: ["tabs"] });
                queryClient.invalidateQueries({
                  predicate: (q) => q.queryKey[0] === "expenses",
                });
                queryClient.invalidateQueries({
                  predicate: (q) => q.queryKey[0] === "balances",
                });
                queryClient.invalidateQueries({ queryKey: ["activity"] });
                setAiDialogOpen(false);
                setAiInputText("");
              } else {
                setAiError(result.error ?? "Failed to add expense");
              }
            }}
          >
            <textarea
              value={aiInputText}
              onChange={(e) => setAiInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (aiInputText.trim() && !aiLoading) {
                    aiFormRef.current?.requestSubmit();
                  }
                }
              }}
              placeholder="Sam dinner olive garden 50"
              className="flex min-h-[100px] w-full rounded-md border border-input bg-input-bg px-3 py-2 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-ring-offset disabled:cursor-not-allowed disabled:opacity-50 md:text-sm resize-none"
              disabled={aiLoading}
              autoFocus
            />

            {aiError && <p className="text-sm text-destructive">{aiError}</p>}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAiDialogOpen(false)}
                disabled={aiLoading}
                className="sm:min-w-[100px]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="default"
                disabled={aiLoading || !aiInputText.trim()}
                className="min-w-[140px]"
              >
                {aiLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 text-foreground animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <CornerDownLeft className="h-4 w-4" />
                    Add expense
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
