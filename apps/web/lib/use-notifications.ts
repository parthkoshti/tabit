"use client";

import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const configuredWsUrl =
  process.env.NEXT_PUBLIC_NOTIFICATIONS_WS_URL ?? "ws://localhost:3002";
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "/api-backend";

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
              const name =
                payload.fromUserName ?? payload.fromUserUsername ?? "Someone";
              toast.info(`New friend request from ${name}`);
            } else if (payload.type === "tab_invite") {
              queryClient.invalidateQueries({
                queryKey: ["pendingTabInviteRequests"],
              });
              const name =
                payload.fromUserName ?? payload.fromUserUsername ?? "Someone";
              toast.info(`${name} invited you to ${payload.tabName}`);
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
