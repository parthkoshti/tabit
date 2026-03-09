"use client";

import Image from "next/image";
import { Link as TransitionLink } from "next-view-transitions";
import { Button } from "@/components/ui/button";
import { appConfig } from "@/app/config";
import { Github } from "lucide-react";

export function Navbar() {
  return (
    <header className="fixed left-0 right-0 top-0 z-50 px-4 pt-4 sm:px-6 sm:pt-6">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between rounded-full border border-border/30 bg-background/70 px-5 shadow-sm backdrop-blur-sm supports-backdrop-filter:bg-background/50">
        <TransitionLink
          href="/"
          className="flex items-center text-foreground transition-opacity hover:opacity-80"
        >
          <Image
            src="/icon-192x192.png"
            alt={appConfig.name}
            width={44}
            height={44}
            className="size-11 rounded-xl"
          />
        </TransitionLink>
        <div className="flex items-center gap-2">
          {appConfig.githubUrl ? (
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="hidden sm:inline-flex text-muted-foreground hover:text-foreground"
            >
              <a
                href={appConfig.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2"
              >
                <Github className="h-4 w-4" />
                Star
              </a>
            </Button>
          ) : null}
          <Button size="sm" asChild className="rounded-full">
            <a href={`${appConfig.pwaUrl}`}>Get started</a>
          </Button>
        </div>
      </div>
    </header>
  );
}
