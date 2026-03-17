import type {
  TabWithMembers,
  TabWithBalance,
  FriendTab,
  Balance,
  Expense,
  Settlement,
  ActivityItem,
  ExpenseAuditLogEntry,
  SettlementAuditLogEntry,
} from "data";

function getApiUrl(): string {
  return "/api";
}

const baseUrl = getApiUrl();

async function request<T>(
  path: string,
  options?: { method?: string; body?: unknown },
): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: options?.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err =
      (data as { error?: string }).error ?? `Request failed: ${res.status}`;
    return { success: false, error: err } as T;
  }
  return data as T;
}

export const api = {
  friends: {
    getPendingRequests: () =>
      request<{
        success: boolean;
        requests: Array<{
          id: string;
          fromUserId: string;
          fromUserUsername: string | null;
          fromUserName: string | null;
          createdAt: string;
        }>;
      }>("/friends/requests/pending"),
    sendRequest: (username: string) =>
      request<{ success: boolean; error?: string }>("/friends/requests", {
        method: "POST",
        body: { username },
      }),
    acceptRequest: (requestId: string) =>
      request<{ success: boolean; friendTabId?: string; error?: string }>(
        `/friends/requests/${requestId}/accept`,
        { method: "POST" },
      ),
    rejectRequest: (requestId: string) =>
      request<{ success: boolean }>(`/friends/requests/${requestId}/reject`, {
        method: "POST",
      }),
    getToken: () =>
      request<{
        success: boolean;
        token: string | null;
        url: string | null;
        error?: string;
      }>("/friends/token"),
    addByToken: (token: string) =>
      request<{
        success: boolean;
        friendTabId?: string;
        alreadyFriends?: boolean;
        error?: string;
      }>("/friends/add-by-token", { method: "POST", body: { token } }),
    search: (
      q: string,
      options?: { includeFriends?: boolean },
    ) =>
      request<{
        success: boolean;
        users: Array<{
          id: string;
          username: string | null;
          name: string | null;
        }>;
      }>(
        `/friends/search?q=${encodeURIComponent(q)}${options?.includeFriends ? "&includeFriends=true" : ""}`,
      ),
    list: () =>
      request<{ success: boolean; friends: FriendTab[] }>("/friends"),
    poke: (friendTabId: string) =>
      request<{ success: boolean; error?: string }>("/friends/poke", {
        method: "POST",
        body: { friendTabId },
      }),
  },
  tabInvites: {
    getByToken: (token: string) =>
      request<{
        success: boolean;
        tab?: { id: string; name: string };
        creator?: { id: string; name: string | null; username: string | null };
        tabId?: string;
        error?: string;
      }>(`/tab-invites/by-token?token=${encodeURIComponent(token)}`),
    joinByToken: (token: string) =>
      request<{
        success: boolean;
        tabId?: string;
        alreadyMember?: boolean;
        error?: string;
      }>("/tab-invites/join-by-token", { method: "POST", body: { token } }),
    getToken: (tabId: string) =>
      request<{ success: boolean; url: string | null; error?: string }>(
        `/tab-invites/token?tabId=${encodeURIComponent(tabId)}`,
      ),
    getPendingRequests: () =>
      request<{ success: boolean; requests: unknown[] }>(
        "/tab-invites/requests/pending",
      ),
    sendRequest: (tabId: string, username: string) =>
      request<{ success: boolean; error?: string }>("/tab-invites/requests", {
        method: "POST",
        body: { tabId, username },
      }),
    acceptRequest: (requestId: string) =>
      request<{
        success: boolean;
        tabId?: string;
        alreadyMember?: boolean;
        error?: string;
      }>(`/tab-invites/requests/${requestId}/accept`, { method: "POST" }),
    rejectRequest: (requestId: string) =>
      request<{ success: boolean }>(
        `/tab-invites/requests/${requestId}/reject`,
        {
          method: "POST",
        },
      ),
  },
  tabs: {
    list: () =>
      request<{ success: boolean; tabs: TabWithBalance[] }>("/tabs"),
    get: (tabId: string) =>
      request<{ success: boolean; tab: TabWithMembers | null; error?: string }>(
        `/tabs/${tabId}`,
      ),
    getBalances: (tabId: string) =>
      request<{ success: boolean; balances: Balance[]; error?: string }>(
        `/tabs/${tabId}/balances`,
      ),
    create: (name: string, currency?: string) =>
      request<{ success: boolean; tabId: string; error?: string }>("/tabs", {
        method: "POST",
        body: currency ? { name, currency } : { name },
      }),
    update: (
      tabId: string,
      updates: { name?: string; currency?: string },
    ) =>
      request<{ success: boolean; error?: string }>(`/tabs/${tabId}`, {
        method: "PATCH",
        body: updates,
      }),
    addMember: (tabId: string, email: string, role?: string) =>
      request<{ success: boolean; error?: string }>(`/tabs/${tabId}/members`, {
        method: "POST",
        body: { email, role: role ?? "member" },
      }),
    removeMember: (tabId: string, userId: string) =>
      request<{ success: boolean; error?: string }>(`/tabs/${tabId}/members`, {
        method: "DELETE",
        body: { userId },
      }),
  },
  expenses: {
    list: (
      tabId: string,
      options?: {
        limit?: number;
        offset?: number;
        filter?: "all" | "involved" | "owed" | "owe";
      },
    ) => {
      const params = new URLSearchParams();
      if (options?.limit != null) params.set("limit", String(options.limit));
      if (options?.offset != null) params.set("offset", String(options.offset));
      if (options?.filter != null && options.filter !== "all")
        params.set("filter", options.filter);
      const qs = params.toString();
      return request<{
        success: boolean;
        expenses: Expense[];
        total?: number;
        error?: string;
      }>(
        `/tabs/${tabId}/expenses${qs ? `?${qs}` : ""}`,
      );
    },
    get: (tabId: string, expenseId: string) =>
      request<{ success: boolean; expense: Expense | null; error?: string }>(
        `/tabs/${tabId}/expenses/${expenseId}`,
      ),
    getAuditLog: (tabId: string, expenseId: string) =>
      request<{ success: boolean; auditLog: ExpenseAuditLogEntry[]; error?: string }>(
        `/tabs/${tabId}/expenses/${expenseId}/audit-log`,
      ),
    create: (
      tabId: string,
      body: {
        amount: number;
        description: string;
        paidById?: string;
        splitType?: string;
        participantIds?: string[];
        splits?: { userId: string; amount: number }[];
        expenseDate?: string | Date;
      },
    ) =>
      request<{
        success: boolean;
        expenseId?: string;
        tabId?: string;
        amount?: number;
        description?: string;
        tabName?: string;
        currency?: string;
        participants?: Array<{
          userId: string;
          name: string | null;
          paid?: number;
          owes?: number;
        }>;
        error?: string;
      }>(`/tabs/${tabId}/expenses`, {
        method: "POST",
        body: { ...body, tabId },
      }),
    createBulk: (
      tabId: string,
      expenses: Array<{
        amount: number;
        description: string;
        paidById: string;
        splitType: "equal" | "custom";
        splits: { userId: string; amount: number }[];
        expenseDate: string;
        participantIds?: string[];
      }>,
    ) =>
      request<{
        success: boolean;
        imported?: number;
        failed?: number;
        errors?: string[];
        error?: string;
      }>(`/tabs/${tabId}/expenses/bulk`, {
        method: "POST",
        body: { expenses },
      }),
    update: (
      tabId: string,
      expenseId: string,
      body: {
        amount?: number;
        description?: string;
        paidById?: string;
        splitType?: string;
        expenseDate?: string;
        participantIds?: string[];
      },
    ) =>
      request<{ success: boolean; error?: string }>(
        `/tabs/${tabId}/expenses/${expenseId}`,
        {
          method: "PATCH",
          body: { ...body, tabId },
        },
      ),
    delete: (tabId: string, expenseId: string) =>
      request<{ success: boolean; error?: string }>(
        `/tabs/${tabId}/expenses/${expenseId}`,
        {
          method: "DELETE",
        },
      ),
    restore: (tabId: string, expenseId: string) =>
      request<{ success: boolean; error?: string }>(
        `/tabs/${tabId}/expenses/${expenseId}/restore`,
        {
          method: "POST",
        },
      ),
    addReaction: (tabId: string, expenseId: string, emoji: string) =>
      request<{ success: boolean; error?: string }>(
        `/tabs/${tabId}/expenses/${expenseId}/reactions`,
        {
          method: "POST",
          body: { emoji },
        },
      ),
    removeReaction: (tabId: string, expenseId: string) =>
      request<{ success: boolean; error?: string }>(
        `/tabs/${tabId}/expenses/${expenseId}/reactions`,
        {
          method: "DELETE",
        },
      ),
  },
  settlements: {
    list: (tabId: string) =>
      request<{ success: boolean; settlements: Settlement[]; error?: string }>(
        `/tabs/${tabId}/settlements`,
      ),
    get: (tabId: string, settlementId: string) =>
      request<{ success: boolean; settlement: Settlement | null; error?: string }>(
        `/tabs/${tabId}/settlements/${settlementId}`,
      ),
    record: (
      tabId: string,
      fromUserId: string,
      toUserId: string,
      amount: number,
    ) =>
      request<{ success: boolean; error?: string }>(
        `/tabs/${tabId}/settlements`,
        {
          method: "POST",
          body: { tabId, fromUserId, toUserId, amount },
        },
      ),
    update: (
      tabId: string,
      settlementId: string,
      body: { fromUserId: string; toUserId: string; amount: number },
    ) =>
      request<{ success: boolean; error?: string }>(
        `/tabs/${tabId}/settlements/${settlementId}`,
        { method: "PATCH", body },
      ),
    delete: (tabId: string, settlementId: string) =>
      request<{ success: boolean; error?: string }>(
        `/tabs/${tabId}/settlements/${settlementId}`,
        { method: "DELETE" },
      ),
    getAuditLog: (tabId: string, settlementId: string) =>
      request<{ success: boolean; auditLog: SettlementAuditLogEntry[]; error?: string }>(
        `/tabs/${tabId}/settlements/${settlementId}/audit-log`,
      ),
  },
  activity: {
    list: (options?: { limit?: number; offset?: number }) => {
      const params = new URLSearchParams();
      if (options?.limit != null) params.set("limit", String(options.limit));
      if (options?.offset != null) params.set("offset", String(options.offset));
      const qs = params.toString();
      return request<{
        success: boolean;
        items: ActivityItem[];
        total?: number;
        error?: string;
      }>(`/activity${qs ? `?${qs}` : ""}`);
    },
  },
  profile: {
    update: (data: {
      name?: string;
      defaultCurrency?: string | null;
    }) =>
      request<{ success: boolean; error?: string }>("/profile", {
        method: "PATCH",
        body: data,
      }),
  },
  username: {
    check: (username: string) =>
      request<{ available: boolean }>(
        `/username/check?username=${encodeURIComponent(username)}`,
      ),
    update: (username: string) =>
      request<{ success: boolean; error?: string }>("/username", {
        method: "PATCH",
        body: { username },
      }),
  },
  push: {
    subscribe: (subscription: PushSubscriptionJSON) =>
      request<{ success: boolean }>("/push/subscribe", {
        method: "POST",
        body: {
          endpoint: subscription.endpoint,
          keys: subscription.keys,
        },
      }),
    unsubscribe: (endpoint: string) =>
      request<{ success: boolean }>("/push/subscribe", {
        method: "DELETE",
        body: { endpoint },
      }),
    test: () =>
      request<{ success: boolean }>("/push/test", {
        method: "POST",
      }),
    testTabInvite: () =>
      request<{ success: boolean }>("/push/test-tab-invite", {
        method: "POST",
      }),
  },
  notifications: {
    getToken: () => request<{ token: string }>("/notifications/token"),
    getMissed: (since: number) =>
      request<{
        success: boolean;
        friendRequests: Array<{
          id: string;
          type: "friend_request";
          requestId: string;
          fromUserId: string;
          fromUserUsername: string | null;
          fromUserName: string | null;
          createdAt: string;
        }>;
        tabInvites: Array<{
          id: string;
          type: "tab_invite";
          requestId: string;
          tabId: string;
          tabName: string;
          fromUserId: string;
          fromUserUsername: string | null;
          fromUserName: string | null;
          createdAt: string;
        }>;
      }>(`/notifications/missed?since=${encodeURIComponent(since)}`),
  },
  ai: {
    addExpense: (body: { text: string }) =>
      request<{
        success: boolean;
        expenseId?: string;
        amount?: number;
        description?: string;
        tabName?: string;
        tabId?: string;
        currency?: string;
        participants?: Array<{
          userId: string;
          name: string | null;
          paid?: number;
          owes?: number;
        }>;
        error?: string;
      }>("/ai/add-expense", { method: "POST", body }),
  },
};

export { getApiUrl };
