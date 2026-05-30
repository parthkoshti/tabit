import "ios-vibrator-pro-max";
import { useEffect } from "react";
import { ThemeProvider } from "next-themes";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { get, set, del, createStore } from "idb-keyval";
import { registerGlobalTapHaptic } from "@/lib/vibrate";
import { queryClient } from "./lib/query-client";

const idbStore =
  typeof window !== "undefined"
    ? createStore("tabit-query-cache", "queries")
    : null;

declare const __APP_VERSION__: string;

const CACHE_BUSTER =
  typeof __APP_VERSION__ !== "undefined"
    ? __APP_VERSION__
    : (import.meta.env.VITE_QUERY_CACHE_BUSTER ?? "v1");

const persister = idbStore
  ? createAsyncStoragePersister({
      storage: {
        getItem: async (key) => await get(key, idbStore),
        setItem: async (key, value) => await set(key, value, idbStore),
        removeItem: async (key) => await del(key, idbStore),
      },
    })
  : ({
      persistClient: async () => {},
      restoreClient: async () => undefined,
      removeClient: async () => {},
    } as const);

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => registerGlobalTapHaptic(), []);

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: 1000 * 60 * 60 * 24 * 7,
          buster: CACHE_BUSTER,
        }}
      >
        {children}
      </PersistQueryClientProvider>
    </ThemeProvider>
  );
}
