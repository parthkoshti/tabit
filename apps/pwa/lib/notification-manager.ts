const configuredWsUrl =
  import.meta.env.VITE_NOTIFICATIONS_WS_URL ?? "ws://localhost:3002";
const apiUrl = "/api-backend";

const TOKEN_LIFETIME_MS = 5 * 60 * 1000; // 5 minutes
const TOKEN_REFRESH_BEFORE_MS = 60 * 1000; // Refresh 1 min before expiry
const PING_INTERVAL_MS = 30000; // 30 seconds
const PONG_TIMEOUT_MS = 60000; // 60 seconds - close if no pong
const MAX_RECONNECT_DELAY_MS = 30000;
const INITIAL_RECONNECT_DELAY_MS = 1000;

export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting";

export type NotificationPayload = {
  type: string;
  tabId?: string;
  expenseId?: string;
  friendTabId?: string;
  requestId?: string;
  [key: string]: unknown;
};

type NotificationListener = (payload: NotificationPayload) => void;
type StateListener = (state: ConnectionState) => void;

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

class NotificationManager {
  private ws: WebSocket | null = null;
  private state: ConnectionState = "disconnected";
  private notificationListeners = new Set<NotificationListener>();
  private stateListeners = new Set<StateListener>();
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private tokenRefreshTimeout: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;
  private lastPongTime = 0;
  private cancelled = false;

  getState(): ConnectionState {
    return this.state;
  }

  addNotificationListener(listener: NotificationListener): () => void {
    this.notificationListeners.add(listener);
    return () => this.notificationListeners.delete(listener);
  }

  addStateListener(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => this.stateListeners.delete(listener);
  }

  private setState(newState: ConnectionState): void {
    if (this.state === newState) return;
    this.state = newState;
    this.stateListeners.forEach((l) => l(newState));
  }

  private emitNotification(payload: NotificationPayload): void {
    this.notificationListeners.forEach((l) => l(payload));
  }

  private clearTimers(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.tokenRefreshTimeout) {
      clearTimeout(this.tokenRefreshTimeout);
      this.tokenRefreshTimeout = null;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleTokenRefresh(): void {
    this.tokenRefreshTimeout = setTimeout(() => {
      if (this.cancelled || this.state === "disconnected") return;
      this.reconnect(true);
    }, TOKEN_LIFETIME_MS - TOKEN_REFRESH_BEFORE_MS);
  }

  private startHeartbeat(): void {
    this.lastPongTime = Date.now();
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "ping" }));
        if (Date.now() - this.lastPongTime > PONG_TIMEOUT_MS) {
          this.ws.close();
        }
      }
    }, PING_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private reconnect(isTokenRefresh = false): void {
    if (this.cancelled) return;
    this.disconnect();
    if (isTokenRefresh) {
      this.setState("reconnecting");
    } else {
      this.setState("connecting");
    }
    this.connect();
  }

  connect(): void {
    if (typeof window === "undefined") return;
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.cancelled = false;
    this.setState("connecting");

    const getTokenAndConnect = async () => {
      if (this.cancelled) return;
      try {
        const res = await fetch(`${apiUrl}/notifications/token`, {
          credentials: "include",
        });
        if (this.cancelled) return;
        if (!res.ok) return;
        const { token } = await res.json();
        if (this.cancelled) return;
        const wsUrl = getWebSocketUrl();
        const url = `${wsUrl}?token=${encodeURIComponent(token)}`;
        const ws = new WebSocket(url);
        if (this.cancelled) {
          ws.close();
          return;
        }

        this.ws = ws;

        ws.onopen = () => {
          if (this.cancelled) return;
          this.reconnectAttempts = 0;
          this.setState("connected");
          this.scheduleTokenRefresh();
          this.startHeartbeat();
        };

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data) as NotificationPayload;

            if (payload.type === "pong") {
              this.lastPongTime = Date.now();
              return;
            }

            this.emitNotification(payload);
          } catch {
            // ignore parse errors
          }
        };

        ws.onclose = () => {
          this.ws = null;
          this.stopHeartbeat();
          this.clearTimers();
          if (this.cancelled) return;

          const delay = Math.min(
            INITIAL_RECONNECT_DELAY_MS * 2 ** this.reconnectAttempts,
            MAX_RECONNECT_DELAY_MS,
          );
          this.reconnectAttempts += 1;
          this.setState("reconnecting");

          this.reconnectTimeout = setTimeout(() => {
            getTokenAndConnect();
          }, delay);
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch {
        if (this.cancelled) return;
        this.reconnectTimeout = setTimeout(() => {
          getTokenAndConnect();
        }, 5000);
      }
    };

    getTokenAndConnect();
  }

  disconnect(): void {
    this.cancelled = true;
    this.clearTimers();
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setState("disconnected");
  }
}

export const notificationManager = new NotificationManager();
