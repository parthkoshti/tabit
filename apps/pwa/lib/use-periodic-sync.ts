import { useEffect } from "react";

const SYNC_TAG = "check-notifications";
const MIN_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours

export function usePeriodicSync(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || typeof navigator === "undefined") return;

    const reg = navigator.serviceWorker?.ready;
    if (!reg) return;

    reg.then((registration) => {
      if (!("periodicSync" in registration)) return;

      const periodicSync = (registration as ServiceWorkerRegistration & {
        periodicSync: { register: (tag: string, options: { minInterval: number }) => Promise<void> };
      }).periodicSync;

      periodicSync
        .register(SYNC_TAG, { minInterval: MIN_INTERVAL_MS })
        .catch(() => {
          // Periodic Sync requires user permission, may fail
        });
    });
  }, [enabled]);
}
