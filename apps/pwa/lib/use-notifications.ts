import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { NotificationPayload } from "models";
import { useSetPushResubscriptionRequired } from "@/app/(app)/context/push-resubscription-context";
import { invalidateForNotification } from "@/src/lib/invalidate-notification";
import {
  realtimeManager,
  type ConnectionState,
} from "@/src/lib/realtime-manager";

export function useNotifications(enabled: boolean): ConnectionState {
  const queryClient = useQueryClient();
  const setNeedsResubscription = useSetPushResubscriptionRequired();
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");

  const queryClientRef = useRef(queryClient);
  const setNeedsResubscriptionRef = useRef(setNeedsResubscription);
  queryClientRef.current = queryClient;
  setNeedsResubscriptionRef.current = setNeedsResubscription;

  useEffect(() => {
    if (!enabled) {
      realtimeManager.disconnect();
      setConnectionState("disconnected");
      return;
    }

    const unsubscribeNotification = realtimeManager.addNotificationListener(
      (payload: NotificationPayload) => {
        const qc = queryClientRef.current;
        const setResub = setNeedsResubscriptionRef.current;

        if (
          (payload as { type: string }).type === "push_resubscription_required"
        ) {
          setResub?.(true);
          toast("Push notifications need to be re-enabled", {
            description: "Your push subscription is no longer valid.",
            action: {
              label: "Settings",
              onClick: () => {
                window.location.assign("/me");
              },
            },
          });
          return;
        }

        invalidateForNotification(qc, payload);
      },
    );

    const unsubscribeState = realtimeManager.addStateListener(
      (state: ConnectionState) => {
        setConnectionState(state);
      },
    );

    realtimeManager.connect();

    return () => {
      unsubscribeNotification();
      unsubscribeState();
      realtimeManager.disconnect();
    };
  }, [enabled]);

  return connectionState;
}
