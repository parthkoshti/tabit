"use client";

import { ThemeProvider } from "next-themes";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { get, set, del, createStore } from "idb-keyval";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 60 * 24,
    },
  },
});

const idbStore =
  typeof window !== "undefined"
    ? createStore("tabit-query-cache", "queries")
    : null;

const CACHE_BUSTER = process.env.NEXT_PUBLIC_QUERY_CACHE_BUSTER ?? "v1";

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
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: 1000 * 60 * 60 * 24,
          buster: CACHE_BUSTER,
        }}
      >
        {children}
      </PersistQueryClientProvider>
    </ThemeProvider>
  );
}
