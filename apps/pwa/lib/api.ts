import { ORPCError } from "@orpc/client";
import { authClient } from "@/lib/auth-client";
import { orpcClient } from "@/src/lib/orpc-client";

export function getApiUrl(): string {
  const base = import.meta.env.VITE_API_URL;
  return base ?? "http://localhost:3001";
}

function errorMessage(err: unknown): string {
  if (err instanceof ORPCError) return err.message;
  if (err instanceof Error) return err.message;
  return "Request failed";
}

async function call<T extends Record<string, unknown>>(
  fn: () => Promise<T>,
): Promise<({ success: true } & T) | { success: false; error: string }> {
  try {
    const data = await fn();
    return { success: true, ...data };
  } catch (err) {
    return { success: false, error: errorMessage(err) };
  }
}

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const api = {
  friends: {
    getPendingRequests: () =>
      call(() => orpcClient.friends.getPendingRequests()),

    sendRequest: (username: string) =>
      call(() => orpcClient.friends.sendRequest({ username })),

    acceptRequest: (requestId: string) =>
      call(() => orpcClient.friends.acceptRequest({ requestId })),

    rejectRequest: (requestId: string) =>
      call(() => orpcClient.friends.rejectRequest({ requestId })),

    getToken: () => call(() => orpcClient.friends.getToken()),

    addByToken: (token: string) =>
      call(() => orpcClient.friends.addByToken({ token })),

    search: (q: string, options?: { includeFriends?: boolean }) =>
      call(() =>
        orpcClient.friends.search({
          q,
          includeFriends: options?.includeFriends,
        }),
      ),

    list: () => call(() => orpcClient.friends.list()),

    poke: (friendTabId: string) =>
      call(() => orpcClient.friends.poke({ friendTabId })),

    sendPaymentReminder: (friendTabId: string, tone: string) =>
      call(() =>
        orpcClient.friends.sendPaymentReminder({
          friendTabId,
          tone: tone as Parameters<
            typeof orpcClient.friends.sendPaymentReminder
          >[0]["tone"],
        }),
      ),
  },

  tabInvites: {
    getByToken: (token: string) =>
      call(() => orpcClient.tabInvites.getByToken({ token })),

    joinByToken: (token: string) =>
      call(() => orpcClient.tabInvites.joinByToken({ token })),

    getToken: (tabId: string) =>
      call(() => orpcClient.tabInvites.getToken({ tabId })),

    getPendingRequests: () =>
      call(() => orpcClient.tabInvites.getPendingRequests()),

    sendRequest: (tabId: string, username: string) =>
      call(() => orpcClient.tabInvites.sendRequest({ tabId, username })),

    acceptRequest: (requestId: string) =>
      call(() => orpcClient.tabInvites.acceptRequest({ requestId })),

    rejectRequest: (requestId: string) =>
      call(() => orpcClient.tabInvites.rejectRequest({ requestId })),
  },

  tabs: {
    list: () => call(() => orpcClient.tabs.list()),

    get: (tabId: string) => call(() => orpcClient.tabs.get({ tabId })),

    getBalances: (tabId: string) =>
      call(() => orpcClient.tabs.getBalances({ tabId })),

    getSharedGroupTabs: (tabId: string) =>
      call(() => orpcClient.tabs.getSharedGroupTabs({ tabId })),

    create: (name: string, currency?: string) =>
      call(() =>
        orpcClient.tabs.create(
          currency !== undefined ? { name, currency } : { name },
        ),
      ),

    update: (tabId: string, updates: { name?: string; currency?: string }) =>
      call(() => orpcClient.tabs.update({ tabId, updates })),

    addMember: (tabId: string, email: string, role?: string) =>
      call(() =>
        orpcClient.tabs.addMember({
          tabId,
          body: {
            email,
            role: (role ?? "member") as "owner" | "member",
          },
        }),
      ),

    removeMember: (tabId: string, userId: string) =>
      call(() => orpcClient.tabs.removeMember({ tabId, userId })),

    createPlaceholder: (tabId: string, displayName: string) =>
      call(() =>
        orpcClient.tabs.createPlaceholder({
          tabId,
          body: { displayName },
        }),
      ),

    renamePlaceholder: (
      tabId: string,
      participantId: string,
      displayName: string,
    ) =>
      call(() =>
        orpcClient.tabs.renamePlaceholder({
          tabId,
          participantId,
          body: { displayName },
        }),
      ),

    mergePlaceholder: (
      tabId: string,
      participantId: string,
      targetUserId: string,
    ) =>
      call(() =>
        orpcClient.tabs.mergePlaceholder({
          tabId,
          participantId,
          body: { targetUserId },
        }),
      ),

    listRecurringExpenses: (tabId: string) =>
      call(() => orpcClient.recurringExpenses.listForTab({ tabId })),

    createRecurringExpense: (tabId: string, body: Record<string, unknown>) =>
      call(() =>
        orpcClient.recurringExpenses.createForTab({ tabId, body }),
      ),
  },

  recurringExpenses: {
    get: (ruleId: string) =>
      call(() => orpcClient.recurringExpenses.get({ ruleId })),

    update: (ruleId: string, body: Record<string, unknown>) =>
      call(() => orpcClient.recurringExpenses.update({ ruleId, body })),

    delete: (ruleId: string) =>
      call(() => orpcClient.recurringExpenses.delete({ ruleId })),
  },

  expenses: {
    list: (
      tabId: string,
      options?: {
        limit?: number;
        offset?: number;
        filter?: "all" | "involved" | "owed" | "owe";
      },
    ) => call(() => orpcClient.expenses.list({ tabId, ...options })),

    get: (tabId: string, expenseId: string) =>
      call(() => orpcClient.expenses.get({ tabId, expenseId })),

    getAuditLog: (tabId: string, expenseId: string) =>
      call(() => orpcClient.expenses.getAuditLog({ tabId, expenseId })),

    fxPreview: (
      tabId: string,
      params: { amount: number; currency: string; expenseDate?: string },
    ) => call(() => orpcClient.expenses.fxPreview({ tabId, ...params })),

    create: (
      tabId: string,
      body: {
        amount: number;
        currency?: string;
        description: string;
        paidById?: string;
        paidByParticipantId?: string;
        splitType?: string;
        participantIds?: string[];
        splits?: { userId: string; amount?: number; weight?: number }[];
        expenseDate?: string | Date;
        createRecurringRule?: Record<string, unknown>;
      },
    ) => call(() => orpcClient.expenses.create({ tabId, body })),

    createBulk: (
      tabId: string,
      expenses: Array<{
        amount: number;
        currency?: string;
        description: string;
        paidById: string;
        splitType: "equal" | "custom" | "percent" | "shares";
        splits: { userId: string; amount?: number; weight?: number }[];
        expenseDate: string;
        participantIds?: string[];
      }>,
    ) => call(() => orpcClient.expenses.createBulk({ tabId, expenses })),

    update: (
      tabId: string,
      expenseId: string,
      body: {
        amount?: number;
        currency?: string;
        description?: string;
        paidById?: string;
        paidByParticipantId?: string;
        splitType?: string;
        expenseDate?: string;
        participantIds?: string[];
        splits?: { userId: string; amount?: number; weight?: number }[];
      },
    ) => call(() => orpcClient.expenses.update({ tabId, expenseId, body })),

    delete: (tabId: string, expenseId: string) =>
      call(() => orpcClient.expenses.delete({ tabId, expenseId })),

    restore: (tabId: string, expenseId: string) =>
      call(() => orpcClient.expenses.restore({ tabId, expenseId })),

    addReaction: (tabId: string, expenseId: string, emoji: string) =>
      call(() =>
        orpcClient.expenses.addReaction({ tabId, expenseId, emoji }),
      ),

    removeReaction: (tabId: string, expenseId: string) =>
      call(() => orpcClient.expenses.removeReaction({ tabId, expenseId })),
  },

  settlements: {
    list: (tabId: string) =>
      call(() => orpcClient.tabs.listSettlements({ tabId })),

    get: (tabId: string, settlementId: string) =>
      call(() => orpcClient.tabs.getSettlement({ tabId, settlementId })),

    record: (
      tabId: string,
      body: {
        fromUserId: string | null;
        toUserId: string | null;
        fromParticipantId: string;
        toParticipantId: string;
        amount: number;
        currency?: string;
        originalAmount?: number;
        settlementDate?: string;
      },
    ) =>
      call(() =>
        orpcClient.tabs.recordSettlement({
          tabId,
          body: { tabId, ...body } as Parameters<
            typeof orpcClient.tabs.recordSettlement
          >[0]["body"],
        }),
      ),

    update: (
      tabId: string,
      settlementId: string,
      body: {
        fromUserId: string | null;
        toUserId: string | null;
        fromParticipantId: string;
        toParticipantId: string;
        amount: number;
        currency?: string;
        originalAmount?: number;
        settlementDate?: string;
      },
    ) =>
      call(() =>
        orpcClient.tabs.updateSettlement({
          tabId,
          settlementId,
          body: body as Parameters<
            typeof orpcClient.tabs.updateSettlement
          >[0]["body"],
        }),
      ),

    delete: (tabId: string, settlementId: string) =>
      call(() => orpcClient.tabs.deleteSettlement({ tabId, settlementId })),

    getAuditLog: (tabId: string, settlementId: string) =>
      call(() =>
        orpcClient.tabs.getSettlementAuditLog({ tabId, settlementId }),
      ),
  },

  activity: {
    list: (options?: { limit?: number; offset?: number }) =>
      call(() => orpcClient.activity.list(options ?? {})),
  },

  profile: {
    update: (data: {
      name?: string;
      defaultCurrency?: string | null;
      timezone?: string | null;
    }) => call(() => orpcClient.profile.update(data)),
  },

  preferences: {
    get: () => call(() => orpcClient.preferences.get()),

    update: (data: {
      addExpensePreference?: "ai" | "manual";
      timezone?: string | null;
    }) => call(() => orpcClient.preferences.update(data)),
  },

  username: {
    check: async (username: string) => {
      const result = await call(() =>
        orpcClient.username.check({ username }),
      );
      if (!result.success) {
        return { available: null as boolean | null, error: result.error };
      }
      return { available: result.available as boolean, error: undefined };
    },

    update: (username: string) =>
      call(() => orpcClient.username.update({ username })),
  },

  push: {
    subscribe: (subscription: PushSubscriptionJSON) =>
      call(() =>
        orpcClient.push.subscribe({
          endpoint: subscription.endpoint!,
          keys: {
            p256dh: subscription.keys!.p256dh,
            auth: subscription.keys!.auth,
          },
        }),
      ),

    unsubscribe: (endpoint: string) =>
      call(() => orpcClient.push.unsubscribe({ endpoint })),

    test: () => call(() => orpcClient.push.test()),

    testTabInvite: () => call(() => orpcClient.push.testTabInvite()),
  },

  notifications: {
    getToken: async (): Promise<{ token: string }> => {
      try {
        const session = await authClient.getSession();
        const userId = session.data?.user?.id;
        if (!userId) throw new Error("Unauthorized");
        return { token: encodeBase64Url(`${userId}:${Date.now()}`) };
      } catch (err) {
        return {
          success: false,
          error: errorMessage(err),
        } as unknown as { token: string };
      }
    },

    getMissed: (since: number) =>
      call(() => orpcClient.notifications.listMissed({ since })),
  },

  ai: {
    addExpense: (body: { text: string }) =>
      call(() => orpcClient.ai.addExpense(body)),
  },
};
