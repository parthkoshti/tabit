"use client";

import { useEffect, Suspense } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { NavTitleProvider } from "./context/nav-title-context";
import { TopNavbar } from "./components/top-navbar";
import { BottomNavbar } from "./components/bottom-navbar";

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
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  return (
    <NavTitleProvider>
      <div className="flex min-h-screen flex-col pb-16">
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
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <AppLayoutContent>{children}</AppLayoutContent>
    </Suspense>
  );
}
