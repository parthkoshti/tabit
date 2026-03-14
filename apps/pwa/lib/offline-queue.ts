import { get, set, createStore } from "idb-keyval";

const STORE_NAME = "tabit-offline-queue";
const QUEUE_KEY = "queue";

export type OfflineActionType =
  | "accept_friend_request"
  | "reject_friend_request"
  | "accept_tab_invite"
  | "reject_tab_invite";

export type OfflineAction = {
  id: string;
  type: OfflineActionType;
  payload: { requestId: string };
  timestamp: number;
  retries: number;
};

const MAX_RETRIES = 3;

function getStore() {
  if (typeof window === "undefined") return null;
  return createStore(STORE_NAME, "actions");
}

async function getQueue(): Promise<OfflineAction[]> {
  const store = getStore();
  if (!store) return [];
  const queue = await get<OfflineAction[]>(QUEUE_KEY, store);
  return queue ?? [];
}

async function setQueue(queue: OfflineAction[]): Promise<void> {
  const store = getStore();
  if (!store) return;
  await set(QUEUE_KEY, queue, store);
}

export async function enqueue(action: Omit<OfflineAction, "id" | "timestamp" | "retries">): Promise<void> {
  const store = getStore();
  if (!store) return;

  const queue = await getQueue();
  const newAction: OfflineAction = {
    ...action,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    retries: 0,
  };
  queue.push(newAction);
  await setQueue(queue);
}

export async function dequeue(): Promise<OfflineAction | null> {
  const queue = await getQueue();
  if (queue.length === 0) return null;
  const [action, ...rest] = queue;
  await setQueue(rest);
  return action;
}

export async function putBack(action: OfflineAction): Promise<void> {
  const queue = await getQueue();
  action.retries += 1;
  if (action.retries < MAX_RETRIES) {
    queue.push(action);
    await setQueue(queue);
  }
}

export async function getAll(): Promise<OfflineAction[]> {
  return getQueue();
}

export async function clear(): Promise<void> {
  const store = getStore();
  if (!store) return;
  await set(QUEUE_KEY, [], store);
}

export async function remove(actionId: string): Promise<void> {
  const queue = await getQueue();
  const filtered = queue.filter((a) => a.id !== actionId);
  await setQueue(filtered);
}
