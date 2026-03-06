"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Link as TransitionLink } from "next-view-transitions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { appConfig } from "@/app/config";

export default function HomePage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (!isPending && session?.user) {
      router.replace("/app");
    }
  }, [session, isPending, router]);

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (session?.user) {
    return null;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="space-y-4 text-center">
        <h1 className="text-3xl font-bold">{appConfig.name}</h1>
        <p className="text-muted-foreground">{appConfig.description}</p>
        <Button asChild>
          <TransitionLink href="/login">Sign in</TransitionLink>
        </Button>
      </div>
    </main>
  );
}
