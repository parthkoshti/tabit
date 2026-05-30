import type { QueryClient } from "@tanstack/react-query";
import type { NotificationPayload } from "models";

export function invalidateForNotification(
  queryClient: QueryClient,
  payload: NotificationPayload,
): void {
  if (payload.type === "friend_request") {
    queryClient.invalidateQueries({
      queryKey: ["pendingFriendRequests"],
    });
  } else if (payload.type === "tab_invite") {
    queryClient.invalidateQueries({
      queryKey: ["pendingTabInviteRequests"],
    });
  } else if (
    payload.type === "friend_request_accepted" ||
    payload.type === "tab_invite_accepted"
  ) {
    queryClient.invalidateQueries({ queryKey: ["friends"] });
    queryClient.invalidateQueries({ queryKey: ["tabs"] });
    if ("tabId" in payload && payload.tabId) {
      queryClient.invalidateQueries({
        queryKey: ["tab", payload.tabId],
      });
      queryClient.invalidateQueries({
        queryKey: ["members", payload.tabId],
      });
    }
  } else if (
    payload.type === "expense_added" ||
    payload.type === "expense_updated" ||
    payload.type === "expense_deleted" ||
    payload.type === "expense_restored" ||
    payload.type === "expense_reaction" ||
    payload.type === "expenses_bulk_imported"
  ) {
    if ("tabId" in payload && payload.tabId) {
      queryClient.invalidateQueries({
        queryKey: ["expenses", payload.tabId],
      });
      queryClient.invalidateQueries({
        queryKey: ["balances", payload.tabId],
      });
      queryClient.invalidateQueries({
        queryKey: ["tab", payload.tabId],
      });
      if (
        "expenseId" in payload &&
        typeof payload.expenseId === "string" &&
        payload.expenseId
      ) {
        queryClient.invalidateQueries({
          queryKey: ["expense", payload.tabId, payload.expenseId],
        });
        queryClient.invalidateQueries({
          queryKey: ["expenseAuditLog", payload.tabId, payload.expenseId],
        });
      }
    }
    queryClient.invalidateQueries({ queryKey: ["tabs"] });
    queryClient.invalidateQueries({ queryKey: ["activity"] });
  } else if (payload.type === "placeholder_merged") {
    if ("tabId" in payload && payload.tabId) {
      queryClient.invalidateQueries({ queryKey: ["tab", payload.tabId] });
      queryClient.invalidateQueries({ queryKey: ["tabs"] });
      queryClient.invalidateQueries({
        queryKey: ["expenses", payload.tabId],
      });
      queryClient.invalidateQueries({
        queryKey: ["balances", payload.tabId],
      });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      queryClient.invalidateQueries({
        queryKey: ["settlements", payload.tabId],
      });
    }
  }
}
