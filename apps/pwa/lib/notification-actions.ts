import { enqueue } from "./offline-queue";
import type { OfflineActionType } from "./offline-queue";

const SYNC_TAG = "sync-notifications";

async function registerSync(): Promise<void> {
  if (typeof navigator === "undefined") return;
  const reg = await navigator.serviceWorker?.ready;
  if (!reg || !("sync" in reg)) return;
  try {
    await (reg as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register(SYNC_TAG);
  } catch {
    // Background Sync not supported
  }
}

export async function queueNotificationAction(
  type: OfflineActionType,
  requestId: string,
): Promise<void> {
  await enqueue({ type, payload: { requestId } });
  await registerSync();
}
