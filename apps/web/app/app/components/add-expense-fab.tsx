"use client";

import { useDeferredValue, useState } from "react";
import { usePathname, useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchFriends, fetchTabs, fetchTab } from "@/app/actions/queries";
import { authClient } from "@/lib/auth-client";
import { AddExpenseForm } from "@/app/app/tabs/[tabId]/add-expense-form";
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
import { Link as TransitionLink } from "next-view-transitions";
import { ArrowLeft, Plus } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

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
  if (pathname === "/app/friends") return true;
  if (pathname === "/app/tabs") return true;
  if (/^\/app\/tabs\/[^/]+$/.test(pathname)) return true;
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
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [selectedTabId, setSelectedTabId] = useState<string | null>(null);

  const { data: friends, isLoading: friendsLoading } = useQuery({
    queryKey: ["friends"],
    queryFn: fetchFriends,
    enabled: open && deferredPathname === "/app/friends",
    staleTime: 0,
  });

  const { data: tabs, isLoading: tabsLoading } = useQuery({
    queryKey: ["tabs"],
    queryFn: fetchTabs,
    enabled: open && deferredPathname === "/app/tabs",
    staleTime: 0,
  });

  const effectiveTabId =
    deferredPathname === "/app/tabs" ? selectedTabId : tabIdFromParams;

  const { data: tab, isLoading: tabLoading } = useQuery({
    queryKey: ["tab", effectiveTabId],
    queryFn: () => fetchTab(effectiveTabId!),
    enabled: open && !!effectiveTabId,
    staleTime: 0,
  });

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setSelectedFriendId(null);
      setSelectedTabId(null);
    }
    setOpen(next);
  };

  const handleExpenseSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["friends"] });
    queryClient.invalidateQueries({ queryKey: ["tabs"] });
    handleOpenChange(false);
  };

  if (!isFabVisible(deferredPathname)) return null;

  const context =
    deferredPathname === "/app/friends"
      ? "friends"
      : deferredPathname === "/app/tabs"
        ? "tabs"
        : "tabDetail";

  return (
    <div
      className="fixed bottom-28 right-4 z-30"
      style={{ viewTransitionName: "add-expense-fab" }}
    >
      <Button
        className="h-12 gap-2 rounded-full px-4 shadow-lg"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-4 w-4" />
        Expense
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-[90vw] rounded-xl">
          <DialogHeader>
            <DialogTitle>Add expense</DialogTitle>
            <DialogDescription>
              {context === "friends" && "Split an expense with a friend"}
              {context === "tabs" && "Select a tab to add an expense"}
              {context === "tabDetail" && "Add a new expense to split"}
            </DialogDescription>
          </DialogHeader>

          {context === "friends" && (
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
                        <TransitionLink href="/app/friends/addFriend">
                          Add friend
                        </TransitionLink>
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

          {context === "tabs" && (
            <>
              {!selectedTabId ? (
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
                        <TransitionLink href="/app/tabs/create">
                          Create tab
                        </TransitionLink>
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
                        onClick={() => setSelectedTabId(null)}
                      >
                        <ArrowLeft /> Pick another tab
                      </Button>
                      <p className="text-sm text-muted-foreground">
                        Add members to this tab to start splitting expenses.
                      </p>
                      <Button asChild variant="outline" className="w-full">
                        <TransitionLink
                          href={`/app/tabs/${selectedTabId}/members`}
                        >
                          Invite members
                        </TransitionLink>
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="-ml-2"
                        onClick={() => setSelectedTabId(null)}
                      >
                        <ArrowLeft /> Pick another tab
                      </Button>
                      <AddExpenseForm
                        tabId={selectedTabId}
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

          {context === "tabDetail" && (
            <>
              {tabLoading ? (
                <div className="flex justify-center py-8">
                  <Spinner />
                </div>
              ) : !tab ? (
                <p className="text-sm text-muted-foreground">Tab not found</p>
              ) : tab.members.length < 2 ? (
                <div className="space-y-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    Add members to this tab to start splitting expenses.
                  </p>
                  <Button asChild variant="outline" className="w-full">
                    <TransitionLink
                      href={`/app/tabs/${tabIdFromParams}/members`}
                    >
                      Invite members
                    </TransitionLink>
                  </Button>
                </div>
              ) : (
                <AddExpenseForm
                  tabId={tabIdFromParams!}
                  members={tab.members}
                  currentUserId={currentUserId}
                  onSuccess={handleExpenseSuccess}
                />
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
