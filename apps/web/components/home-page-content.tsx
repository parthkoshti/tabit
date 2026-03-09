"use client";

import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { appConfig } from "@/app/config";
import {
  ReceiptText,
  Code2,
  Users,
  Github,
  ArrowRight,
  Monitor,
} from "lucide-react";

const features = [
  {
    icon: ReceiptText,
    title: "No limits",
    description:
      "Create groups for trips, roommates, or shared expenses. Unlimited tabs, unlimited expenses. No cap, no timer, no paywall.",
  },
  {
    icon: Monitor,
    title: "Everywhere",
    description:
      "iPhone, Android, web, macOS. Install on your phone or use in any browser. Your tabs sync across devices.",
  },
  {
    icon: Users,
    title: "Friends",
    description:
      "Add friends by QR code or invite link. Settle up in seconds. No premium gate on basic features.",
  },
  {
    icon: Code2,
    title: "Open source",
    description:
      "Transparent and community-driven. No lock-in, no surprise limits. Your data, your control.",
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
    <div className="relative mx-auto mt-20 w-full max-w-[360px]">
      <div className="absolute -inset-8 rounded-3xl bg-primary/[0.06] blur-3xl" />
      <div className="relative overflow-hidden rounded-2xl border border-border/20 bg-card/90 shadow-xl shadow-foreground/5 ring-1 ring-border/10 backdrop-blur-sm dark:bg-card/80 dark:ring-white/5">
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

export function HomePageContent() {
  return (
    <>
      <section className="relative w-screen left-1/2 -ml-[50vw] overflow-hidden px-6 pt-28 pb-32 sm:px-8 sm:pt-36 sm:pb-40 lg:px-12">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 100% 80% at 50% -30%, rgba(94, 106, 210, 0.12), transparent 60%), radial-gradient(ellipse 80% 50% at 100% 50%, rgba(94, 106, 210, 0.06), transparent 50%), radial-gradient(ellipse 80% 50% at 0% 80%, rgba(94, 106, 210, 0.05), transparent 50%)",
          }}
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--border-subtle)_1px,transparent_1px),linear-gradient(to_bottom,var(--border-subtle)_1px,transparent_1px)] bg-size-[5rem_5rem] opacity-50 mask-[radial-gradient(ellipse_70%_50%_at_50%_0%,black_30%,transparent_100%)]" />
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Splitwise alternative free
          </p>
          <h1 className="mt-4 text-[2.75rem] font-bold tracking-[-0.04em] text-foreground sm:text-5xl md:text-[3.75rem] md:leading-[1.08]">
            Split expenses with friends.{" "}
            <span className="bg-linear-to-r from-primary via-primary to-primary/70 bg-clip-text text-transparent">
              Without the limits.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
            The app is{" "}
            <span className="font-semibold text-foreground">free forever</span>.
            Works on iPhone, Android, web, macOS, any browser. No daily cap, no
            wait timer, no upgrade prompt. Create tabs, add friends, settle up.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="min-w-[200px] rounded-xl text-base font-medium shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/25"
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
                className="min-w-[140px] rounded-xl border-border/40 bg-background/50 backdrop-blur-sm hover:bg-muted/30"
              >
                <a
                  href={appConfig.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2"
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

      <section className="relative w-screen left-1/2 -ml-[50vw] border-t border-border/30 bg-muted/10 px-6 py-24 sm:px-8 sm:py-32 lg:px-12">
        <div className="mx-auto max-w-4xl">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-border/20 bg-card/60 px-8 py-10 shadow-sm ring-1 ring-border/5 dark:bg-card/40 dark:ring-white/5 sm:px-10 sm:py-12">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                The problem
              </p>
              <h2 className="mt-3 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
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
            <div className="overflow-hidden rounded-2xl border border-border/20 bg-card/60 px-8 py-10 shadow-sm ring-1 ring-border/5 dark:bg-card/40 dark:ring-white/5 sm:px-10 sm:py-12">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Cross-platform
              </p>
              <h2 className="mt-3 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                Works on all platforms
              </h2>
              <div className="space-y-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
                <p>
                  iPhone, Android, web, macOS, Windows, Linux. Open it in any
                  browser or install it like a native app on your phone. No app
                  store required.
                </p>
                <p>
                  Add an expense on your phone during a trip, then check balances
                  on your laptop at home. Your tabs and friends sync across
                  every device. One account, everywhere.
                </p>
              </div>
              <Button asChild size="sm" className="mt-6 rounded-xl">
                <a
                  href={`${appConfig.pwaUrl}/login`}
                  className="inline-flex items-center gap-2"
                >
                  Get started
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="relative w-screen left-1/2 -ml-[50vw] border-t border-border/30 bg-muted/5 px-6 py-24 sm:px-8 sm:py-32 lg:px-12">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Features
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Built for people who split bills, not paywalls.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              No artificial limits. No dark patterns. Just what you need to
              split and settle.
            </p>
          </div>
          <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
            {features.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="group rounded-xl border border-border/20 bg-card/50 p-6 transition-all duration-200 hover:border-border/40 hover:bg-card/80 hover:shadow-md dark:bg-card/30 dark:hover:bg-card/50"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold text-foreground">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative w-screen left-1/2 -ml-[50vw] border-t border-border/30 px-6 py-24 sm:px-8 sm:py-32 lg:px-12">
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
            className="mt-10 rounded-xl px-10 font-medium shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/25"
          >
            <a
              href={`${appConfig.pwaUrl}/login`}
              className="inline-flex items-center gap-2"
            >
              Get started
              <ArrowRight className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </section>
    </>
  );
}
