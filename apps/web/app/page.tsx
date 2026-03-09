"use client";

import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
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

const heroAvatarIds = ["hero-you", "hero-alex", "hero-sam"] as const;

const paidByIdToName: Record<string, string> = {
  "hero-you": "You",
  "hero-alex": "Alex",
  "hero-sam": "Sam",
};

const heroExpenses = [
  { label: "Weekly groceries", amount: "$30.00", paidById: "hero-you" },
  { label: "Electric bill", amount: "$75.00", paidById: "hero-alex" },
  { label: "Internet", amount: "$37.50", paidById: "hero-sam" },
  { label: "Pizza night", amount: "$7.50", paidById: "hero-you" },
];

function HeroPreview() {
  return (
    <div className="relative mx-auto mt-16 w-full max-w-[340px]">
      <div className="absolute -inset-6 rounded-[28px] bg-primary/[0.07] blur-3xl" />
      <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/80 shadow-2xl shadow-foreground/6 backdrop-blur-xl dark:border-white/5 dark:bg-white/5 dark:shadow-foreground/10">
        <div className="border-b border-border/50 bg-muted/30 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {["Apartment", "House", "Office"].map((tab, i) => (
                <div
                  key={tab}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    i === 0
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  {tab}
                </div>
              ))}
            </div>
            <div className="flex gap-1">
              <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
              <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
            </div>
          </div>
        </div>
        <div className="space-y-4 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">
              Apartment
            </span>
            <div className="flex items-center gap-1.5">
              <div className="flex -space-x-2">
                {heroAvatarIds.map((id) => (
                  <UserAvatar
                    key={id}
                    userId={id}
                    size="xs"
                    className="ring-2 ring-background"
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">3 friends</span>
            </div>
          </div>
          <div className="max-h-32 space-y-2 overflow-hidden">
            {heroExpenses.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/30 bg-muted/30 px-3 py-2.5 dark:border-white/5 dark:bg-white/5"
              >
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-left text-sm font-medium text-foreground">
                    {item.label}
                  </span>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <UserAvatar userId={item.paidById} size="xs" />
                    <span className="text-xs text-muted-foreground">
                      {paidByIdToName[item.paidById]} paid
                    </span>
                  </div>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                  {item.amount}
                </span>
              </div>
            ))}
          </div>
          <div className="space-y-2 border-t border-border/50 pt-3">
            <div className="flex items-center justify-between gap-2 text-sm">
              <div className="flex items-center gap-2">
                <UserAvatar userId="hero-alex" size="xs" />
                <span className="text-muted-foreground">You owe Alex</span>
              </div>
              <span className="font-semibold text-negative">$12.50</span>
            </div>
            <div className="rounded-lg bg-positive/10 px-3 py-2 dark:bg-positive/15">
              <span className="text-xs font-medium text-positive">
                Settle up
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden px-6 pt-24 pb-28 sm:px-8 sm:pt-32 sm:pb-36 lg:px-12">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(94, 106, 210, 0.18), transparent 50%), radial-gradient(ellipse 60% 40% at 80% 50%, rgba(94, 106, 210, 0.08), transparent 50%), radial-gradient(ellipse 60% 40% at 20% 80%, rgba(94, 106, 210, 0.06), transparent 50%)",
          }}
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--border-subtle)_1px,transparent_1px),linear-gradient(to_bottom,var(--border-subtle)_1px,transparent_1px)] bg-size-[4rem_4rem] mask-[radial-gradient(ellipse_80%_50%_at_50%_0%,black_40%,transparent_100%)]" />
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-4 py-2 text-sm font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            No wait timer. No paywall.
          </div>
          <h1 className="mt-8 text-[2.75rem] font-bold tracking-[-0.03em] text-foreground sm:text-5xl md:text-[3.5rem] md:leading-[1.1]">
            Split expenses with friends.{" "}
            <span className="bg-linear-to-r from-primary via-primary to-primary/70 bg-clip-text text-transparent">
              Without the limits.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
            No daily cap, no wait timer, no upgrade prompt. Create tabs, add
            friends, settle up.
          </p>
          <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="min-w-[180px] rounded-full text-base shadow-lg shadow-primary/25"
            >
              <a
                href={`${appConfig.pwaUrl}/login`}
                className="inline-flex items-center gap-2"
              >
                Get started
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
            {appConfig.githubUrl ? (
              <Button
                variant="outline"
                size="lg"
                asChild
                className="rounded-full border-border/60 bg-transparent hover:bg-muted/50"
              >
                <a
                  href={appConfig.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center"
                >
                  <Github className="h-4 w-4" />
                  Star on GitHub
                </a>
              </Button>
            ) : null}
          </div>
          <HeroPreview />
        </div>
      </section>

      <section className="border-t border-border/50 bg-muted/20 px-6 py-24 sm:px-8 sm:py-32 lg:px-12">
        <div className="mx-auto max-w-2xl">
          <div className="overflow-hidden rounded-3xl border border-border/40 bg-card/80 px-8 py-10 shadow-sm sm:px-12 sm:py-12 dark:border-border/50 dark:bg-card/50">
            <div className="space-y-6">
              <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                Fed up with expense limits?
              </h2>
              <div className="space-y-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
                <p>
                  Three expenses. Then a timer. Then a paywall. Splitwise locked
                  the basics behind a subscription. I got annoyed. So I made
                  this.
                </p>
                <p>No cap. No wait. No upsell. Split the bill and move on.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border/50 px-6 py-24 sm:px-8 sm:py-32 lg:px-12">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Built for people who split bills, not paywalls.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              No artificial limits. No dark patterns. Just what you need to
              split and settle.
            </p>
          </div>
          <div className="mt-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="group rounded-2xl border border-border/40 bg-card/60 p-6 transition-all duration-200 hover:border-primary/25 hover:bg-card/90 hover:shadow-lg hover:shadow-primary/5 dark:border-border/50 dark:bg-card/40 dark:hover:bg-card/60"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15 group-hover:scale-105">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 font-semibold text-foreground">{title}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border/50 px-6 py-24 sm:px-8 sm:py-32 lg:px-12">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Ready to split?
          </h2>
          <p className="mt-4 text-muted-foreground">
            No credit card required. No expense limit. No wait timer.
          </p>
          <Button
            asChild
            size="lg"
            className="mt-10 rounded-full px-10 shadow-lg shadow-primary/20"
          >
            <a
              href={`${appConfig.pwaUrl}/login`}
              className="inline-flex items-center gap-2"
            >
              Create your first tab
              <ArrowRight className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </section>
    </>
  );
}
