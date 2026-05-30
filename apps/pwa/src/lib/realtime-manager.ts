import { io, type Socket } from "socket.io-client";
import type { NotificationPayload } from "models";

const configuredRealtimeUrl =
  import.meta.env.VITE_REALTIME_URL ?? "http://localhost:3002";

export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting";

type NotificationListener = (payload: NotificationPayload) => void;
type StateListener = (state: ConnectionState) => void;

function getRealtimeUrl(): string {
  if (typeof window === "undefined") return configuredRealtimeUrl;
  try {
    const parsed = new URL(configuredRealtimeUrl);
    const isLocalHost =
      parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (!isLocalHost) {
      return configuredRealtimeUrl;
    }
    const host = window.location.hostname;
    const port = parsed.port || "3002";
    const protocol = window.location.protocol;
    return `${protocol}//${host}:${port}`;
  } catch {
    return configuredRealtimeUrl;
  }
}

function usePollingOnly(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const target = new URL(getRealtimeUrl());
    return window.location.protocol === "https:" && target.protocol === "http:";
  } catch {
    return false;
  }
}

class RealtimeManager {
  private socket: Socket | null = null;
  private state: ConnectionState = "disconnected";
  private notificationListeners = new Set<NotificationListener>();
  private stateListeners = new Set<StateListener>();
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

  connect(): void {
    if (typeof window === "undefined") return;
    if (this.socket?.connected) return;

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this.cancelled = false;
    this.setState("connecting");

    const socket = io(getRealtimeUrl(), {
      withCredentials: true,
      // HTTPS static PWA -> HTTP workers: avoid failed ws/wss upgrade.
      transports: usePollingOnly() ? ["polling"] : ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
    });

    this.socket = socket;

    socket.on("connect", () => {
      if (this.cancelled) return;
      this.setState("connected");
    });

    socket.on("disconnect", () => {
      if (this.cancelled) return;
      this.setState("reconnecting");
    });

    socket.io.on("reconnect_attempt", () => {
      if (this.cancelled) return;
      this.setState("reconnecting");
    });

    socket.io.on("reconnect", () => {
      if (this.cancelled) return;
      this.setState("connected");
    });

    socket.on("notification", (payload: NotificationPayload) => {
      this.emitNotification(payload);
    });

    socket.on("connect_error", () => {
      if (this.cancelled) return;
      // Upgrade attempts can fail while polling is still connected.
      if (!socket.connected) {
        this.setState("reconnecting");
      }
    });
  }

  disconnect(): void {
    this.cancelled = true;
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.setState("disconnected");
  }
}

export const realtimeManager = new RealtimeManager();
