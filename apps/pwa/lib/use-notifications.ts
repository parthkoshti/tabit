import { useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSetPushResubscriptionRequired } from "@/app/(app)/context/push-resubscription-context";

const configuredWsUrl =
  import.meta.env.VITE_NOTIFICATIONS_WS_URL ?? "ws://localhost:3002";
const apiUrl = "/api-backend";

function getWebSocketUrl(): string {
  if (typeof window === "undefined") return configuredWsUrl;
  try {
    const parsed = new URL(configuredWsUrl);
    if (parsed.hostname !== "localhost") {
      return configuredWsUrl;
    }
    const host = window.location.hostname;
    const port = parsed.port || "3002";
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${host}:${port}`;
  } catch {
    return configuredWsUrl;
  }
}

export function useNotifications(enabled: boolean) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setNeedsResubscription = useSetPushResubscriptionRequired();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const reconnectAttempts = useRef(0);

  const connect = useCallback(() => {
    if (!enabled) return;

    let cancelled = false;

    const getTokenAndConnect = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(`${apiUrl}/notifications/token`, {
          credentials: "include",
        });
        if (cancelled) return;
        if (!res.ok) return;
        const { token } = await res.json();
        if (cancelled) return;
        const wsUrl = getWebSocketUrl();
        const url = `${wsUrl}?token=${encodeURIComponent(token)}`;
        const ws = new WebSocket(url);
        if (cancelled) {
          ws.close();
          return;
        }

        ws.onopen = () => {
          reconnectAttempts.current = 0;
        };

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);

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
              if (payload.tabId) {
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
              payload.type === "expenses_bulk_imported"
            ) {
              if (payload.tabId) {
                queryClient.invalidateQueries({
                  queryKey: ["expenses", payload.tabId],
                });
                queryClient.invalidateQueries({
                  queryKey: ["balances", payload.tabId],
                });
                queryClient.invalidateQueries({
                  queryKey: ["tab", payload.tabId],
                });
              }
              queryClient.invalidateQueries({ queryKey: ["tabs"] });
              queryClient.invalidateQueries({ queryKey: ["activity"] });
            } else if (payload.type === "push_resubscription_required") {
              setNeedsResubscription?.(true);
              toast("Push notifications need to be re-enabled", {
                description: "Your push subscription is no longer valid.",
                action: {
                  label: "Settings",
                  onClick: () => navigate("/me"),
                },
              });
            }
          } catch {
            // ignore parse errors
          }
        };

        ws.onclose = () => {
          wsRef.current = null;
          if (cancelled) return;
          const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 30000);
          reconnectAttempts.current += 1;
          reconnectTimeoutRef.current = setTimeout(() => {
            getTokenAndConnect();
          }, delay);
        };

        ws.onerror = () => {
          ws.close();
        };

        wsRef.current = ws;
      } catch {
        if (cancelled) return;
        reconnectTimeoutRef.current = setTimeout(() => {
          getTokenAndConnect();
        }, 5000);
      }
    };

    getTokenAndConnect();

    return () => {
      cancelled = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [enabled, queryClient, navigate, setNeedsResubscription]);

  useEffect(() => {
    const cleanup = connect();
    return () => {
      if (typeof cleanup === "function") cleanup();
    };
  }, [connect]);
}
