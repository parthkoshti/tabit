"use client";

import Image from "next/image";
import { Link as TransitionLink } from "next-view-transitions";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { appConfig } from "@/app/config";
import {
  ReceiptText,
  Smartphone,
  Code2,
  Users,
  Github,
  ArrowRight,
  Sparkles,
} from "lucide-react";

const features = [
  {
    icon: ReceiptText,
    title: "Tabs",
    description:
      "Create groups for trips, roommates, or shared expenses. Log as many as you want. Never hit a limit.",
  },
  {
    icon: Smartphone,
    title: "PWA",
    description:
      "Install on your phone and use it like a native app. Works offline. Add expenses anywhere, no upgrade popups.",
  },
  {
    icon: Code2,
    title: "Open source",
    description:
      "Transparent and community-driven. No lock-in, no surprise limits. Your data, your control.",
  },
  {
    icon: Users,
    title: "Friends",
    description:
      "Add friends by QR code or invite link. Settle up in seconds. No premium gate on basic features.",
  },
] as const;

function HeroPreview() {
  return (
    <div className="relative mx-auto mt-12 w-full max-w-sm">
      <div className="absolute -inset-4 rounded-2xl bg-primary/5 blur-2xl" />
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-foreground/4 dark:shadow-foreground/8">
        <div className="border-b border-border bg-muted/50 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
            <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
            <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
          </div>
        </div>
        <div className="space-y-4 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              Trip to Paris
            </span>
            <span className="text-xs text-muted-foreground">3 members</span>
          </div>
          <div className="space-y-2">
            {[
              { label: "Dinner", amount: "42.00", who: "You paid" },
              { label: "Museum", amount: "24.00", who: "Alex paid" },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2"
              >
                <span className="text-sm text-foreground">{item.label}</span>
                <span className="text-sm font-medium text-foreground">
                  {item.amount}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="text-sm text-muted-foreground">You owe</span>
            <span className="text-sm font-semibold text-primary">12.00</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-10 border-b border-border/50 bg-background/80 backdrop-blur-xl supports-backdrop-filter:bg-background/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <TransitionLink
            href="/"
            className="flex items-center gap-2 font-semibold text-foreground transition-colors hover:text-primary"
          >
            <Image
              src="/icon-192x192.png"
              alt={appConfig.name}
              width={64}
              height={64}
              className="size-12"
            />
          </TransitionLink>
          <div className="flex items-center gap-2">
            {/* <ThemeToggle /> */}
            {appConfig.githubUrl ? (
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="hidden sm:inline-flex"
              >
                <a
                  href={appConfig.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2"
                >
                  <Github className="h-4 w-4" />
                  Star us
                </a>
              </Button>
            ) : null}
            <Button size="sm" asChild>
              <TransitionLink href="/login">Get started</TransitionLink>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden px-6 pt-16 pb-24 sm:pt-24 sm:pb-32">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,var(--primary)/15%,transparent)]" />
          <div className="mx-auto max-w-4xl text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              No wait timer. No paywall.
            </div>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl md:leading-tight">
              Split expenses with friends. Without the limits.
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl sm:leading-relaxed">
              Log as many expenses as you want. No daily cap, no wait timer, no
              upgrade prompt. Create tabs, add friends, settle up.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button asChild size="lg" className="min-w-[160px]">
                <TransitionLink
                  href="/login"
                  className="inline-flex items-center gap-2"
                >
                  Get started free
                  <ArrowRight className="h-4 w-4" />
                </TransitionLink>
              </Button>
              {appConfig.githubUrl ? (
                <Button variant="outline" size="lg" asChild>
                  <a
                    href={appConfig.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center"
                  >
                    <Github className="h-4 w-4" />
                    Star us on GitHub
                  </a>
                </Button>
              ) : null}
            </div>
            <HeroPreview />
          </div>
        </section>

        <section className="border-t border-border bg-muted/20 px-6 py-16 sm:py-20">
          <div className="mx-auto max-w-3xl">
            <div className="overflow-hidden rounded-2xl border border-border bg-card px-6 py-8 shadow-sm sm:px-10 sm:py-10">
              <div className="border-l-4 border-primary pl-6 sm:pl-8">
                <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                  Fed up with expense limits?
                </h2>
                <div className="mt-4 space-y-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
                  <p>
                    You know the drill: log a few expenses, hit a cap, wait for
                    a timer, get nudged to upgrade. Splitwise put basic
                    splitting behind a paywall.
                  </p>
                  <p>
                    We built Tab It because we were tired of it too. No
                    3-expense limit. No wait. No premium upsell. Just split.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-secondary/30 px-6 py-20 sm:py-28">
          <div className="mx-auto max-w-6xl">
            <div className="text-center">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Built for people who split bills, not paywalls.
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
                No artificial limits. No dark patterns. Just what you need to
                split and settle.
              </p>
            </div>
            <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {features.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="group rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:border-primary/20 hover:shadow-md dark:hover:shadow-primary/5"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 font-semibold text-foreground">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border px-6 py-16 sm:py-20">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Ready to split?
            </h2>
            <p className="mt-3 text-muted-foreground">
              No credit card required. No expense limit. No wait timer.
            </p>
            <Button asChild size="lg" className="mt-8">
              <TransitionLink
                href="/login"
                className="inline-flex items-center gap-2"
              >
                Create your first tab
                <ArrowRight className="h-4 w-4" />
              </TransitionLink>
            </Button>
          </div>
        </section>

        <footer className="border-t border-border px-6 py-8">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex flex-col items-center gap-1 sm:items-start">
              <span className="text-sm text-muted-foreground">
                {appConfig.name}
              </span>
              <span className="text-xs text-muted-foreground/80">
                Built because splitting bills shouldn&apos;t cost you.
              </span>
            </div>
            {appConfig.githubUrl ? (
              <a
                href={appConfig.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <Github className="h-4 w-4" />
                Star us on GitHub
              </a>
            ) : null}
          </div>
        </footer>
      </main>
    </div>
  );
}
