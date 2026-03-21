import { useState, useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { authClient } from "@/lib/auth-client";
import { AddExpenseForm } from "../tabs/[tabId]/add-expense-form";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { getDisplayName } from "@/lib/display-name";
import { ArrowLeft, Search } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import {
  TabListItem,
  type TabListItemData,
} from "@/components/tab-list-item";
import { staggerContainer, staggerItem } from "@/lib/animations";
import { AnimatedCard } from "@/components/motion/animated-card";

type LogExpenseManualProps = {
  onSuccess: () => void;
};

export function LogExpenseManual({ onSuccess }: LogExpenseManualProps) {
  const params = useParams<{ tabId?: string }>();
  const [searchParams] = useSearchParams();
  const tabIdFromParams = params?.tabId ?? searchParams.get("tabId");
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const currentUserId = session?.user?.id ?? "";

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTabId, setSelectedTabId] = useState<string | null>(null);
  const [pickedAnotherTab, setPickedAnotherTab] = useState(false);

  const { data: friends, isLoading: friendsLoading } = useQuery({
    queryKey: ["friends"],
    queryFn: async () => {
      const r = await api.friends.list();
      return r.success ? (r.friends ?? []) : [];
    },
    enabled: true,
  });

  const { data: tabs, isLoading: tabsLoading } = useQuery({
    queryKey: ["tabs"],
    queryFn: async () => {
      const r = await api.tabs.list();
      return r.success ? (r.tabs ?? []) : [];
    },
    enabled: true,
  });

  const effectiveTabId =
    selectedTabId ??
    (tabIdFromParams && !pickedAnotherTab ? tabIdFromParams : null);

  const allTabs = useMemo((): TabListItemData[] => {
    const items: TabListItemData[] = [];
    tabs?.forEach((t) => {
      items.push({
        type: "group",
        id: t.id,
        name: t.name,
        balance: t.balance ?? 0,
        currency: t.currency,
        expenseCount: t.expenseCount ?? 0,
        lastExpenseDate: t.lastExpenseDate,
        memberUserIds: t.memberUserIds,
      });
    });
    friends?.forEach((f) => {
      items.push({
        type: "direct",
        id: f.id,
        displayName: getDisplayName(f.friend, undefined, { useFullName: true }),
        username: f.friend.username,
        balance: f.balance,
        currency: f.currency,
        expenseCount: f.expenseCount,
        lastExpenseDate: f.lastExpenseDate,
        friendId: f.friend.id,
      });
    });
    return items;
  }, [tabs, friends]);

  const filteredTabs = useMemo(() => {
    if (!searchQuery.trim()) return allTabs;
    const q = searchQuery.trim().toLowerCase().replace(/^@/, "");
    return allTabs.filter((item) => {
      const name = item.type === "group" ? item.name : item.displayName;
      if (name.toLowerCase().includes(q)) return true;
      if (
        item.type === "direct" &&
        item.username?.toLowerCase().includes(q)
      ) {
        return true;
      }
      return false;
    });
  }, [allTabs, searchQuery]);

  const { data: tab, isLoading: tabLoading } = useQuery({
    queryKey: ["tab", effectiveTabId],
    queryFn: async () => {
      const r = await api.tabs.get(effectiveTabId!);
      return r.success && r.tab ? r.tab : null;
    },
    enabled: !!effectiveTabId,
  });

  const handleExpenseCreated = () => {
    queryClient.invalidateQueries({ queryKey: ["friends"] });
    queryClient.invalidateQueries({ queryKey: ["tabs"] });
  };

  const isLoading = tabsLoading || friendsLoading;
  const hasAnyTabs = (tabs?.length ?? 0) > 0 || (friends?.length ?? 0) > 0;

  return (
    <>
      {!effectiveTabId ? (
        <>
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex justify-center py-8"
              >
                <Spinner />
              </motion.div>
            ) : !hasAnyTabs ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="space-y-4 py-4"
              >
                <p className="text-sm text-muted-foreground">
                  No tabs yet. Create a tab or add a friend first.
                </p>
                <div className="flex flex-col gap-2">
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/tabs/create">Create tab</Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/friends/addFriend">Add friend</Link>
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-3"
              >
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search tabs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
                  {filteredTabs.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      No tabs match your search
                    </p>
                  ) : (
                    <motion.div
                      className="flex w-full flex-col gap-3"
                      variants={staggerContainer}
                      initial="initial"
                      animate="animate"
                    >
                      {filteredTabs.map((item) => (
                        <motion.div
                          key={item.id}
                          variants={staggerItem}
                          className="w-full"
                        >
                          <AnimatedCard className="w-full">
                            <TabListItem
                              item={item}
                              currentUserId={currentUserId}
                              onClick={() => setSelectedTabId(item.id)}
                            />
                          </AnimatedCard>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      ) : (
        <>
          <AnimatePresence mode="wait">
            {tabLoading ? (
              <motion.div
                key="tab-loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex justify-center py-8"
              >
                <Spinner />
              </motion.div>
            ) : !tab ? (
              <motion.p
                key="tab-not-found"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-sm text-muted-foreground"
              >
                Tab not found
              </motion.p>
            ) : tab.members.length < 2 && !tab.isDirect ? (
              <motion.div
                key="tab-invite"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="space-y-4 py-4"
              >
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
                  <Link to={`/tabs/${effectiveTabId}/members`}>
                    Invite members
                  </Link>
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="tab-form"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
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
                  tabCurrency={tab.currency ?? "USD"}
                  members={tab.members}
                  currentUserId={currentUserId}
                  onSuccess={onSuccess}
                  onExpenseCreated={handleExpenseCreated}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </>
  );
}
