"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { appConfig } from "@/app/config";

function InviteRedirectContent() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const url = new URL("/invite", appConfig.pwaUrl);
    searchParams.forEach((value, key) => {
      url.searchParams.set(key, value);
    });
    window.location.href = url.toString();
  }, [searchParams]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <p className="text-muted-foreground">Redirecting...</p>
    </main>
  );
}

export default function InviteRedirect() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen flex-col items-center justify-center p-8">
          <p className="text-muted-foreground">Loading...</p>
        </main>
      }
    >
      <InviteRedirectContent />
    </Suspense>
  );
}
