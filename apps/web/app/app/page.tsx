"use client";

import { Button } from "@/components/ui/button";
import { appConfig } from "@/app/config";
import { ArrowRight } from "lucide-react";
import { Link as TransitionLink } from "next-view-transitions";

export default function AppMovedPage() {
  const pwaUrl = appConfig.pwaUrl;

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-24">
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          The app has moved
        </h1>
        <p className="mt-4 text-muted-foreground">
          {appConfig.name} now runs at a dedicated URL. Use the link below to
          continue.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild size="lg" className="rounded-full">
            <a
              href={pwaUrl}
              className="inline-flex items-center gap-2"
            >
              Go to {appConfig.name}
              <ArrowRight className="h-4 w-4" />
            </a>
          </Button>
          <Button asChild variant="outline" size="lg" className="rounded-full">
            <TransitionLink
              href="/"
              className="inline-flex items-center gap-2"
            >
              Back to home
            </TransitionLink>
          </Button>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          You&apos;ll need to reinstall the app for this to take effect.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          New URL:{" "}
          <a
            href={pwaUrl}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {pwaUrl.replace(/^https?:\/\//, "")}
          </a>
        </p>
      </div>
    </main>
  );
}
