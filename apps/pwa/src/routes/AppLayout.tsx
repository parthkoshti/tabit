import { useEffect, Suspense } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { authClient } from "@/lib/auth-client";
import { needsProfileSetup } from "@/lib/profile";
import { useNotifications } from "@/lib/use-notifications";
import { useAppBadge } from "@/lib/use-app-badge";
import { usePeriodicSync } from "@/lib/use-periodic-sync";
import { PushResubscriptionProvider } from "@/app/(app)/context/push-resubscription-context";
import { TopNavbar } from "@/app/(app)/components/top-navbar";
import { ConnectionBanner } from "@/app/(app)/components/connection-banner";
import { BottomNavbar } from "@/app/(app)/components/bottom-navbar";
import { AddExpenseFAB } from "@/app/(app)/components/add-expense-fab";
import { LoadingScreen } from "@/app/(app)/components/loading-screen";
import { PageTransition } from "@/components/motion/page-transition";

function AppLayoutContent() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const { data: session, isPending } = authClient.useSession();

  const connectionState = useNotifications(!!session?.user);
  useAppBadge(!!session?.user);
  usePeriodicSync(!!session?.user);

  useEffect(() => {
    if (isPending) return;
    if (!session?.user) {
      const returnTo =
        pathname +
        (searchParams.toString() ? `?${searchParams.toString()}` : "");
      navigate(
        returnTo
          ? `/login?callbackURL=${encodeURIComponent(returnTo)}`
          : "/login",
        { replace: true },
      );
      return;
    }
    if (needsProfileSetup(session.user) && pathname !== "/onboarding") {
      const returnTo =
        pathname +
        (searchParams.toString() ? `?${searchParams.toString()}` : "");
      navigate(`/onboarding?returnTo=${encodeURIComponent(returnTo)}`, {
        replace: true,
      });
    }
  }, [session, isPending, navigate, pathname, searchParams]);

  if (isPending) {
    return <LoadingScreen />;
  }

  if (!session?.user) {
    return null;
  }

  const isOnboarding = pathname === "/onboarding";

  return (
    <div className="fixed inset-0 flex flex-col overflow-clip">
      {!isOnboarding && (
        <>
          <ConnectionBanner connectionState={connectionState} />
          <TopNavbar />
        </>
      )}
      <main className="app-layout-safe-bottom app-scroll-hide min-h-0 flex-1 overflow-auto overscroll-none pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] pt-[calc(3.5rem+env(safe-area-inset-top,0px))]">
        <PageTransition />
      </main>
      {!isOnboarding && <BottomNavbar />}
      {!isOnboarding && <AddExpenseFAB />}
    </div>
  );
}

export function AppLayout() {
  return (
    <PushResubscriptionProvider>
      <Suspense fallback={<LoadingScreen />}>
        <AppLayoutContent />
      </Suspense>
    </PushResubscriptionProvider>
  );
}
