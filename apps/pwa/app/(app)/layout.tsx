"use client";

import { useEffect, Suspense } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { needsProfileSetup } from "@/lib/profile";
import { useNotifications } from "@/lib/use-notifications";
import { NavTitleProvider } from "./context/nav-title-context";
import { TopNavbar } from "./components/top-navbar";
import { BottomNavbar } from "./components/bottom-navbar";
import { AddExpenseFAB } from "./components/add-expense-fab";
import { LoadingScreen } from "./components/loading-screen";

function AppLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session, isPending } = authClient.useSession();

  useNotifications(!!session?.user);

  useEffect(() => {
    if (isPending) return;
    if (!session?.user) {
      const returnTo =
        pathname +
        (searchParams.toString() ? `?${searchParams.toString()}` : "");
      router.replace(
        returnTo
          ? `/login?callbackURL=${encodeURIComponent(returnTo)}`
          : "/login",
      );
      return;
    }
    if (needsProfileSetup(session.user) && pathname !== "/onboarding") {
      const returnTo =
        pathname +
        (searchParams.toString() ? `?${searchParams.toString()}` : "");
      router.replace(
        `/onboarding?returnTo=${encodeURIComponent(returnTo)}`,
      );
    }
  }, [session, isPending, router, pathname, searchParams]);

  if (isPending) {
    return <LoadingScreen />;
  }

  if (!session?.user) {
    return null;
  }

  const isOnboarding = pathname === "/onboarding";

  return (
    <NavTitleProvider>
      <div className="fixed inset-0 flex flex-col overflow-clip">
        {!isOnboarding && <TopNavbar />}
        <main
          className="app-layout-safe-bottom app-scroll-hide min-h-0 flex-1 overflow-auto overscroll-none pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] pt-[calc(3.5rem+env(safe-area-inset-top,0px))]"
          style={{ viewTransitionName: "main-content" }}
        >
          {children}
        </main>
        {!isOnboarding && <BottomNavbar />}
        {!isOnboarding && <AddExpenseFAB />}
      </div>
    </NavTitleProvider>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <AppLayoutContent>{children}</AppLayoutContent>
    </Suspense>
  );
}
