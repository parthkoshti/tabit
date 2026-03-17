import { createStore, clear } from "idb-keyval";
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function useBustCache() {
  const queryClient = useQueryClient();

  const bustCache = useCallback(async () => {
    queryClient.clear();
    const idbStore = createStore("tabit-query-cache", "queries");
    await clear(idbStore);
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
    }
    localStorage.clear();
    window.location.reload();
  }, [queryClient]);

  return bustCache;
}
