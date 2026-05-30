import { useEffect } from "react";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { Providers } from "../providers";
import { UpdateGate } from "@/components/update-gate";
import { Toaster } from "@/components/ui/sonner";
import { registerOfflineSyncListeners } from "@/lib/offline-sync";

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
});

function RootComponent() {
  useEffect(() => {
    registerOfflineSyncListeners();
  }, []);

  return (
    <Providers>
      <UpdateGate>
        <div className="h-full overflow-hidden bg-background font-sans text-foreground">
          <Outlet />
        </div>
        <Toaster />
      </UpdateGate>
    </Providers>
  );
}
