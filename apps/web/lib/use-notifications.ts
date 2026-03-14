"use client";

import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

const configuredWsUrl =
  process.env.VITE_NOTIFICATIONS_WS_URL ?? "ws://localhost:3002";
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
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const reconnectAttempts = useRef(0);

  const connect = useCallback(() => {
    if (!enabled) return;

    const getTokenAndConnect = async () => {
      try {
        const res = await fetch(`${apiUrl}/notifications/token`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const { token } = await res.json();
        const wsUrl = getWebSocketUrl();
        const url = `${wsUrl}?token=${encodeURIComponent(token)}`;
        const ws = new WebSocket(url);

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
              payload.type === "expense_deleted" ||
              payload.type === "expense_restored" ||
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
                if (
                  "expenseId" in payload &&
                  typeof payload.expenseId === "string" &&
                  payload.expenseId
                ) {
                  queryClient.invalidateQueries({
                    queryKey: ["expense", payload.tabId, payload.expenseId],
                  });
                  queryClient.invalidateQueries({
                    queryKey: [
                      "expenseAuditLog",
                      payload.tabId,
                      payload.expenseId,
                    ],
                  });
                }
              }
              queryClient.invalidateQueries({ queryKey: ["tabs"] });
              queryClient.invalidateQueries({ queryKey: ["activity"] });
            }
          } catch {
            // ignore parse errors
          }
        };

        ws.onclose = () => {
          wsRef.current = null;
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
        // retry later
        reconnectTimeoutRef.current = setTimeout(() => {
          getTokenAndConnect();
        }, 5000);
      }
    };

    getTokenAndConnect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [enabled, queryClient]);

  useEffect(() => {
    const cleanup = connect();
    return () => {
      if (typeof cleanup === "function") cleanup();
    };
  }, [connect]);
}
