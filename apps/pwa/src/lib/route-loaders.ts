import type { QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

/** Fire-and-forget prefetch — does not block route navigation. */
export function prefetchTabs(queryClient: QueryClient) {
  void queryClient.prefetchQuery({
    queryKey: ["tabs"],
    queryFn: async () => {
      const r = await api.tabs.list();
      return r.success ? (r.tabs ?? []) : [];
    },
  });
  void queryClient.prefetchQuery({
    queryKey: ["pendingTabInviteRequests"],
    queryFn: async () => {
      const r = await api.tabInvites.getPendingRequests();
      return r.success ? (r.requests ?? []) : [];
    },
  });
}

export function prefetchTab(queryClient: QueryClient, tabId: string) {
  void queryClient.prefetchQuery({
    queryKey: ["tab", tabId],
    queryFn: async () => {
      const r = await api.tabs.get(tabId);
      return r.success && r.tab ? r.tab : null;
    },
  });
  void queryClient.prefetchInfiniteQuery({
    queryKey: ["expenses", tabId, "all"],
    queryFn: async ({ pageParam }) => {
      const r = await api.expenses.list(tabId, {
        limit: 20,
        offset: pageParam,
        filter: "all",
      });
      return r.success
        ? { expenses: r.expenses ?? [], total: r.total ?? 0 }
        : { expenses: [], total: 0 };
    },
    initialPageParam: 0,
    getNextPageParam: (
      lastPage: { expenses: unknown[]; total: number },
      allPages: { expenses: unknown[]; total: number }[],
    ) => {
      if (typeof lastPage?.total !== "number") return undefined;
      const loaded = (allPages ?? []).reduce(
        (sum: number, p) =>
          sum + (Array.isArray(p?.expenses) ? p.expenses.length : 0),
        0,
      );
      return loaded < lastPage.total ? loaded : undefined;
    },
  });
  void queryClient.prefetchQuery({
    queryKey: ["settlements", tabId],
    queryFn: async () => {
      const r = await api.settlements.list(tabId);
      return r.success ? (r.settlements ?? []) : [];
    },
  });
  void queryClient.prefetchQuery({
    queryKey: ["balances", tabId],
    queryFn: async () => {
      const r = await api.tabs.getBalances(tabId);
      return r.success ? (r.balances ?? []) : [];
    },
  });
}

export function prefetchFriends(queryClient: QueryClient) {
  void queryClient.prefetchQuery({
    queryKey: ["friends"],
    queryFn: async () => {
      const r = await api.friends.list();
      return r.success ? (r.friends ?? []) : [];
    },
  });
  void queryClient.prefetchQuery({
    queryKey: ["pendingFriendRequests"],
    queryFn: async () => {
      const r = await api.friends.getPendingRequests();
      return r.success ? (r.requests ?? []) : [];
    },
  });
}

export function prefetchActivity(queryClient: QueryClient) {
  void queryClient.prefetchInfiniteQuery({
    queryKey: ["activity"],
    queryFn: async ({ pageParam }) => {
      const r = await api.activity.list({ limit: 20, offset: pageParam });
      return r.success
        ? { items: r.items ?? [], total: r.total ?? 0 }
        : { items: [], total: 0 };
    },
    initialPageParam: 0,
    getNextPageParam: (
      lastPage: { items: unknown[]; total: number },
      allPages: { items: unknown[]; total: number }[],
    ) => {
      if (typeof lastPage?.total !== "number") return undefined;
      const loaded = (allPages ?? []).reduce(
        (sum: number, p) =>
          sum + (Array.isArray(p?.items) ? p.items.length : 0),
        0,
      );
      return loaded < lastPage.total ? loaded : undefined;
    },
  });
}

export function prefetchExpense(
  queryClient: QueryClient,
  tabId: string,
  expenseId: string,
) {
  prefetchTab(queryClient, tabId);
  void queryClient.prefetchQuery({
    queryKey: ["expense", tabId, expenseId],
    queryFn: async () => {
      const r = await api.expenses.get(tabId, expenseId);
      return r.success && r.expense ? r.expense : null;
    },
  });
}

export function prefetchSettlement(
  queryClient: QueryClient,
  tabId: string,
  settlementId: string,
) {
  prefetchTab(queryClient, tabId);
  void queryClient.prefetchQuery({
    queryKey: ["settlement", tabId, settlementId],
    queryFn: async () => {
      const r = await api.settlements.get(tabId, settlementId);
      return r.success && r.settlement ? r.settlement : null;
    },
  });
}

export function prefetchRecurringExpense(
  queryClient: QueryClient,
  ruleId: string,
) {
  void queryClient.prefetchQuery({
    queryKey: ["recurring-expense", ruleId],
    queryFn: async () => {
      const r = await api.recurringExpenses.get(ruleId);
      if (!r.success) throw new Error("error" in r ? r.error : "Failed to load");
      if (!r.rule) throw new Error("Failed to load");
      return r.rule;
    },
  });
}
