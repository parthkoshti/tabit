"use client";

import { useEffect, Suspense } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { NavTitleProvider } from "./context/nav-title-context";
import { TopNavbar } from "./components/top-navbar";
import { BottomNavbar } from "./components/bottom-navbar";
import { LoadingScreen } from "./components/loading-screen";

function AppLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (!isPending && !session?.user) {
      const returnTo = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : "");
      router.replace(returnTo ? `/login?callbackURL=${encodeURIComponent(returnTo)}` : "/login");
    }
  }, [session, isPending, router, pathname, searchParams]);

  if (isPending) {
    return <LoadingScreen />;
  }

  if (!session?.user) {
    return null;
  }

  return (
    <NavTitleProvider>
      <div className="app-layout-safe-bottom flex min-h-screen flex-col pb-[calc(4rem+env(safe-area-inset-bottom,0px))]">
        <TopNavbar />
        <main
          className="min-h-0 flex-1 overflow-auto"
          style={{ viewTransitionName: "main-content" }}
        >
          {children}
        </main>
        <BottomNavbar />
      </div>
    </NavTitleProvider>
  );
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <AppLayoutContent>{children}</AppLayoutContent>
    </Suspense>
  );
}
