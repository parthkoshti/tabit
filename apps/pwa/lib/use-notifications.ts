import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSetPushResubscriptionRequired } from "@/app/(app)/context/push-resubscription-context";
import {
  notificationManager,
  type ConnectionState,
  type NotificationPayload,
} from "./notification-manager";

export function useNotifications(enabled: boolean): ConnectionState {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setNeedsResubscription = useSetPushResubscriptionRequired();
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");

  const navigateRef = useRef(navigate);
  const queryClientRef = useRef(queryClient);
  const setNeedsResubscriptionRef = useRef(setNeedsResubscription);
  navigateRef.current = navigate;
  queryClientRef.current = queryClient;
  setNeedsResubscriptionRef.current = setNeedsResubscription;

  useEffect(() => {
    if (!enabled) {
      notificationManager.disconnect();
      setConnectionState("disconnected");
      return;
    }

    const unsubscribeNotification = notificationManager.addNotificationListener(
      (payload: NotificationPayload) => {
        const qc = queryClientRef.current;
        const nav = navigateRef.current;
        const setResub = setNeedsResubscriptionRef.current;

        if (payload.type === "friend_request") {
          qc.invalidateQueries({
            queryKey: ["pendingFriendRequests"],
          });
        } else if (payload.type === "tab_invite") {
          qc.invalidateQueries({
            queryKey: ["pendingTabInviteRequests"],
          });
        } else if (
          payload.type === "friend_request_accepted" ||
          payload.type === "tab_invite_accepted"
        ) {
          qc.invalidateQueries({ queryKey: ["friends"] });
          qc.invalidateQueries({ queryKey: ["tabs"] });
          if (payload.tabId) {
            qc.invalidateQueries({
              queryKey: ["tab", payload.tabId],
            });
            qc.invalidateQueries({
              queryKey: ["members", payload.tabId],
            });
          }
        } else if (
          payload.type === "expense_added" ||
          payload.type === "expense_updated" ||
          payload.type === "expense_deleted" ||
          payload.type === "expense_restored" ||
          payload.type === "expenses_bulk_imported"
        ) {
          if (payload.tabId) {
            qc.invalidateQueries({
              queryKey: ["expenses", payload.tabId],
            });
            qc.invalidateQueries({
              queryKey: ["balances", payload.tabId],
            });
            qc.invalidateQueries({
              queryKey: ["tab", payload.tabId],
            });
            if (
              "expenseId" in payload &&
              typeof payload.expenseId === "string" &&
              payload.expenseId
            ) {
              qc.invalidateQueries({
                queryKey: ["expense", payload.tabId, payload.expenseId],
              });
              qc.invalidateQueries({
                queryKey: ["expenseAuditLog", payload.tabId, payload.expenseId],
              });
            }
          }
          qc.invalidateQueries({ queryKey: ["tabs"] });
          qc.invalidateQueries({ queryKey: ["activity"] });
        } else if (payload.type === "push_resubscription_required") {
          setResub?.(true);
          toast("Push notifications need to be re-enabled", {
            description: "Your push subscription is no longer valid.",
            action: {
              label: "Settings",
              onClick: () => nav("/me"),
            },
          });
        }
      },
    );

    const unsubscribeState = notificationManager.addStateListener(
      (state: ConnectionState) => {
        setConnectionState(state);
      },
    );

    notificationManager.connect();

    return () => {
      unsubscribeNotification();
      unsubscribeState();
      notificationManager.disconnect();
    };
  }, [enabled]);

  return connectionState;
}
