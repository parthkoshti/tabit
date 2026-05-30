import { toast } from "sonner";
import { api } from "./api";
import {
  dequeue,
  putBack,
  remove,
  type OfflineAction,
} from "./offline-queue";

function isBusinessError(
  result: { success: boolean },
): result is { success: false; error: string } {
  return result.success === false;
}

async function processAction(action: OfflineAction): Promise<boolean> {
  const p = action.payload;

  switch (action.type) {
    case "accept_friend_request": {
      const r = await api.friends.acceptRequest(p.requestId as string);
      if (isBusinessError(r)) {
        toast.error(r.error ?? "Could not accept friend request");
        return true;
      }
      return true;
    }
    case "reject_friend_request": {
      const r = await api.friends.rejectRequest(p.requestId as string);
      if (isBusinessError(r)) {
        toast.error(r.error ?? "Could not reject friend request");
        return true;
      }
      return true;
    }
    case "accept_tab_invite": {
      const r = await api.tabInvites.acceptRequest(p.requestId as string);
      if (isBusinessError(r)) {
        toast.error(r.error ?? "Could not accept tab invite");
        return true;
      }
      return true;
    }
    case "reject_tab_invite": {
      const r = await api.tabInvites.rejectRequest(p.requestId as string);
      if (isBusinessError(r)) {
        toast.error(r.error ?? "Could not reject tab invite");
        return true;
      }
      return true;
    }
    case "expense_create": {
      const r = await api.expenses.create(
        p.tabId as string,
        p.body as Parameters<typeof api.expenses.create>[1],
      );
      if (isBusinessError(r)) {
        toast.error(r.error ?? "Could not create expense (server rejected)");
        return true;
      }
      return true;
    }
    case "expense_update": {
      const r = await api.expenses.update(
        p.tabId as string,
        p.expenseId as string,
        p.body as Record<string, unknown>,
      );
      if (isBusinessError(r)) {
        toast.error(r.error ?? "Could not update expense (server rejected)");
        return true;
      }
      return true;
    }
    case "expense_delete": {
      const r = await api.expenses.delete(
        p.tabId as string,
        p.expenseId as string,
      );
      if (isBusinessError(r)) {
        toast.error(r.error ?? "Could not delete expense (server rejected)");
        return true;
      }
      return true;
    }
    case "expense_restore": {
      const r = await api.expenses.restore(
        p.tabId as string,
        p.expenseId as string,
      );
      if (isBusinessError(r)) {
        toast.error(r.error ?? "Could not restore expense (server rejected)");
        return true;
      }
      return true;
    }
    case "settlement_create": {
      const r = await api.settlements.record(
        p.tabId as string,
        p.body as Parameters<typeof api.settlements.record>[1],
      );
      if (isBusinessError(r)) {
        toast.error(r.error ?? "Could not record settlement (server rejected)");
        return true;
      }
      return true;
    }
    case "settlement_update": {
      const r = await api.settlements.update(
        p.tabId as string,
        p.settlementId as string,
        p.body as Parameters<typeof api.settlements.update>[2],
      );
      if (isBusinessError(r)) {
        toast.error(r.error ?? "Could not update settlement (server rejected)");
        return true;
      }
      return true;
    }
    case "settlement_delete": {
      const r = await api.settlements.delete(
        p.tabId as string,
        p.settlementId as string,
      );
      if (isBusinessError(r)) {
        toast.error(r.error ?? "Could not delete settlement (server rejected)");
        return true;
      }
      return true;
    }
    default:
      return true;
  }
}

export async function processOfflineQueue(): Promise<void> {
  let action = await dequeue();
  while (action) {
    try {
      const done = await processAction(action);
      if (done) {
        await remove(action.id);
      } else {
        await putBack(action);
      }
    } catch {
      await putBack(action);
    }
    action = await dequeue();
  }
}

export function registerOfflineSyncListeners(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("online", () => {
    void processOfflineQueue();
  });

  navigator.serviceWorker?.addEventListener("message", (event) => {
    if (event.data?.type === "PROCESS_OFFLINE_QUEUE") {
      void processOfflineQueue();
    }
  });
}
