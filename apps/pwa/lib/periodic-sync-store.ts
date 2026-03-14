import { get, set, createStore } from "idb-keyval";

const STORE_NAME = "tabit-periodic-sync";
const LAST_CHECK_KEY = "lastCheck";

function getStore() {
  if (typeof self === "undefined") return null;
  return createStore(STORE_NAME, "state");
}

export async function getLastCheckTime(): Promise<number> {
  const store = getStore();
  if (!store) return 0;
  const value = await get<number>(LAST_CHECK_KEY, store);
  return value ?? 0;
}

export async function setLastCheckTime(timestamp: number): Promise<void> {
  const store = getStore();
  if (!store) return;
  await set(LAST_CHECK_KEY, timestamp, store);
}
