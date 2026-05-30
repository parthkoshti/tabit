import { Suspense, useEffect, useLayoutEffect } from "react";
import {
  createFileRoute,
  Outlet,
  useRouterState,
  useSearch,
} from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { needsProfileSetup } from "@/lib/profile";
import { useNotifications } from "@/lib/use-notifications";
import { useAppBadge } from "@/lib/use-app-badge";
import { usePeriodicSync } from "@/lib/use-periodic-sync";
import { PushResubscriptionProvider } from "@/app/(app)/context/push-resubscription-context";
import { UpdateBannerProvider } from "@/app/(app)/context/update-banner-context";
import { TopNavbar } from "@/app/(app)/components/top-navbar";
import { BottomNavbar } from "@/app/(app)/components/bottom-navbar";
import { VersionMismatchBanner } from "@/components/version-mismatch-banner";
import { LoadingScreen } from "@/app/(app)/components/loading-screen";
import type { ConnectionState } from "@/src/lib/realtime-manager";
import { useNavStore } from "@/lib/stores/nav-store";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <PushResubscriptionProvider>
      <Suspense fallback={<LoadingScreen />}>
        <AuthenticatedLayoutContent />
      </Suspense>
    </PushResubscriptionProvider>
  );
}

function AuthenticatedLayoutContent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useSearch({ strict: false }) as Record<string, string | undefined>;
  const { data: session, isPending } = authClient.useSession();
  const setDisplayPathname = useNavStore((s) => s.setDisplayPathname);

  useLayoutEffect(() => {
    setDisplayPathname(pathname);
  }, [pathname, setDisplayPathname]);

  const connectionState = useNotifications(!!session?.user);
  useAppBadge(!!session?.user);
  usePeriodicSync(!!session?.user);

  useEffect(() => {
    if (isPending) return;
    if (!session?.user) {
      const searchStr = new URLSearchParams(
        Object.entries(search).filter(
          (entry): entry is [string, string] => entry[1] != null,
        ),
      ).toString();
      const returnTo = pathname + (searchStr ? `?${searchStr}` : "");
      const loginUrl = returnTo
        ? `/login?callbackURL=${encodeURIComponent(returnTo)}`
        : "/login";
      window.location.replace(loginUrl);
      return;
    }
    if (needsProfileSetup(session.user) && pathname !== "/onboarding") {
      const searchStr = new URLSearchParams(
        Object.entries(search).filter(
          (entry): entry is [string, string] => entry[1] != null,
        ),
      ).toString();
      const returnTo = pathname + (searchStr ? `?${searchStr}` : "");
      window.location.replace(
        `/onboarding?returnTo=${encodeURIComponent(returnTo)}`,
      );
    }
  }, [session, isPending, pathname, search]);

  if (isPending) {
    return <LoadingScreen />;
  }

  if (!session?.user) {
    return null;
  }

  const isOnboarding = pathname === "/onboarding";

  return (
    <UpdateBannerProvider>
      <AuthenticatedShell
        isOnboarding={isOnboarding}
        connectionState={connectionState}
      />
    </UpdateBannerProvider>
  );
}

function AuthenticatedShell({
  isOnboarding,
  connectionState,
}: {
  isOnboarding: boolean;
  connectionState: ConnectionState;
}) {
  return (
    <div className="app-shell fixed inset-0 flex flex-col">
      {!isOnboarding && <TopNavbar />}
      {!isOnboarding && <VersionMismatchBanner />}
      <main
        className={
          isOnboarding
            ? "app-scroll-hide min-h-0 flex-1 overflow-y-auto overscroll-y-none"
            : "app-main app-scroll-hide min-h-0 flex-1 overflow-y-auto overscroll-y-none"
        }
      >
        <Outlet />
      </main>
      {!isOnboarding && <BottomNavbar connectionState={connectionState} />}
    </div>
  );
}
