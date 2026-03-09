function getApiUrl(): string {
  return "/api-backend";
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
    search: (q: string) =>
      request<{
        success: boolean;
        users: Array<{
          id: string;
          username: string | null;
          name: string | null;
        }>;
      }>(`/friends/search?q=${encodeURIComponent(q)}`),
    list: () => request<{ success: boolean; friends: unknown[] }>("/friends"),
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
    list: () => request<{ success: boolean; tabs: unknown[] }>("/tabs"),
    get: (tabId: string) =>
      request<{ success: boolean; tab: unknown; error?: string }>(
        `/tabs/${tabId}`,
      ),
    create: (name: string) =>
      request<{ success: boolean; tabId: string; error?: string }>("/tabs", {
        method: "POST",
        body: { name },
      }),
    update: (tabId: string, name: string) =>
      request<{ success: boolean; error?: string }>(`/tabs/${tabId}`, {
        method: "PATCH",
        body: { name },
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
    list: (tabId: string) =>
      request<{ success: boolean; expenses: unknown[] }>(
        `/tabs/${tabId}/expenses`,
      ),
    create: (
      tabId: string,
      body: {
        amount: number;
        description: string;
        paidById?: string;
        splitType?: string;
        participantIds?: string[];
        expenseDate?: string | Date;
      },
    ) =>
      request<{ success: boolean; expenseId: string; error?: string }>(
        `/tabs/${tabId}/expenses`,
        { method: "POST", body: { ...body, tabId } },
      ),
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
  },
  settlements: {
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
  },
  profile: {
    update: (name: string) =>
      request<{ success: boolean; error?: string }>("/profile", {
        method: "PATCH",
        body: { name },
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
  },
};

export { getApiUrl };
