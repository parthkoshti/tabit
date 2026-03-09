"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { appConfig } from "@/app/config";

function LoginRedirectContent() {
  const searchParams = useSearchParams();
  const callbackURL = searchParams.get("callbackURL");

  useEffect(() => {
    const url = new URL("/login", appConfig.pwaUrl);
    if (callbackURL) {
      url.searchParams.set("callbackURL", callbackURL);
    }
    window.location.href = url.toString();
  }, [callbackURL]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <p className="text-muted-foreground">Redirecting to sign in...</p>
    </main>
  );
}

export default function LoginRedirect() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen flex-col items-center justify-center p-8">
          <p className="text-muted-foreground">Loading...</p>
        </main>
      }
    >
      <LoginRedirectContent />
    </Suspense>
  );
}
