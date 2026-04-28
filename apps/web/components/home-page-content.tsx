"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { motion, useInView, useMotionValue, useSpring } from "framer-motion";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { appConfig } from "@/app/config";
import {
  ReceiptText,
  Users,
  Github,
  ArrowRight,
  Monitor,
  Mic,
  QrCode,
  Zap,
  MessageCircle,
  Download,
  BanknoteArrowUp,
  Wallet,
  ChevronLeft,
  Settings,
  PieChart,
  BellRing,
  CalendarClock,
  Link2,
} from "lucide-react";

const staggerChild = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
};

const features = [
  {
    icon: Mic,
    title: "Log expenses in seconds",
    description:
      'Just say what happened: "Alex paid 30 for pizza in Roomies," and it\'s done.',
  },
  {
    icon: Monitor,
    title: "Always with you",
    description:
      "Use it on your phone, laptop, or tablet. Everything stays in sync so you're never out of the loop.",
  },
  {
    icon: Zap,
    title: "Know the moment it happens",
    description:
      'Get notified when someone adds an expense or settles up. Alerts show who actually paid, even if someone else logged it. No more "did you add that yet?" texts.',
  },
  {
    icon: QrCode,
    title: "QR and link invites",
    description:
      "Add friends or invite people to tabs with a QR code or a shareable link. Whatever works for you and your friends.",
  },
  {
    icon: MessageCircle,
    title: "React to expenses",
    description:
      'Drop an emoji on an expense. Great for a quick "thanks" or calling out that suspiciously expensive dinner.',
  },
  {
    icon: PieChart,
    title: "Split it your way",
    description:
      "Equal split by default, or set exact amounts, percentages that add up to 100%, or shares, whatever matches real life.",
  },
  {
    icon: ReceiptText,
    title: "Works for trips abroad",
    description:
      "Road trips and mixed wallets—log what you paid in local money without juggling spreadsheets. Tab rolls everything into your tab's currency.",
  },
  {
    icon: Users,
    title: "For any situation",
    description:
      "Roommates, road trips, couples, friend groups. Filter expenses by what you're owed or what you owe. Unlimited tabs.",
  },
  {
    icon: Download,
    title: "Already on Splitwise?",
    description:
      "Bring your history with you. Import your Splitwise data and pick up right where you left off.",
  },
  {
    icon: CalendarClock,
    title: "Recurring bills, handled",
    description:
      "Rent, subscriptions, splits that happen weekly or monthly. Pause anytime; timezone-aware schedules.",
  },
  {
    icon: BellRing,
    title: "Payment reminders",
    description:
      "On a one-on-one tab, when your friend owes you, send a push reminder and choose how direct you want the tone to be.",
  },
  {
    icon: BanknoteArrowUp,
    title: "Any currency",
    description:
      "Pick the tab's home currency, then record each expense and each settlement in whatever currency you actually used. Live rates convert by transaction date. Built for travel and everyday splits.",
  },
  {
    icon: Link2,
    title: "1-on-1 meets group context",
    description:
      "See shared group tabs right from a friend's tab, including each net balance, so nothing gets lost between conversations.",
  },
] as const;

const heroExpenses = [
  {
    label: "Groceries",
    amount: "$94.00",
    paidBy: "You",
    paidById: "hero-you",
    yourShare: "$47.00",
    timeAgo: "2h ago",
    owed: true,
  },
  {
    label: "Thai takeout",
    amount: "$52.00",
    paidBy: "Alex K",
    paidById: "hero-alex",
    yourShare: "$26.00",
    timeAgo: "Yesterday",
    owed: false,
  },
  {
    label: "Electricity",
    amount: "$118.00",
    paidBy: "You",
    paidById: "hero-you",
    yourShare: "$59.00",
    timeAgo: "Mar 19",
    owed: true,
  },
];

function HeroPreview() {
  const y = useMotionValue(0);
  const springY = useSpring(y, { stiffness: 100, damping: 30 });

  return (
    <motion.div
      className="relative mx-auto mt-20 w-full max-w-[300px]"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      onMouseEnter={() => y.set(-4)}
      onMouseLeave={() => y.set(0)}
      style={{ y: springY }}
    >
      <motion.div
        className="absolute -inset-8 rounded-3xl bg-primary/6 blur-3xl"
        animate={{ opacity: [0.5, 0.8, 0.5], scale: [1, 1.02, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Phone shell */}
      <div className="relative overflow-hidden rounded-[2.25rem] border-[3px] border-foreground/10 bg-[#0d0e10] shadow-2xl shadow-black/40">
        {/* Status bar */}
        <div className="flex items-center justify-between px-5 pt-3 pb-1">
          <span className="text-[10px] font-semibold text-white/80">9:41</span>
          <div className="h-3 w-14 rounded-full bg-white/10" />
          <div className="flex items-center gap-1">
            <div className="h-1.5 w-3 rounded-sm bg-white/30" />
            <div className="h-1.5 w-1.5 rounded-full bg-white/30" />
          </div>
        </div>

        {/* Top navbar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.3 }}
          className="flex items-center justify-between px-3 py-2.5"
        >
          <div className="flex items-center gap-2 min-w-0">
            <ChevronLeft className="h-4 w-4 shrink-0 text-primary" />
            <BanknoteArrowUp className="h-4 w-4 shrink-0 text-primary" />
            <span className="text-sm font-semibold text-white truncate">
              Apartment
            </span>
            <div className="h-2 w-2 rounded-full bg-positive" />
          </div>
          <Settings className="h-4 w-4 shrink-0 text-white/40" />
        </motion.div>

        {/* Content */}
        <div className="space-y-3 px-3 pb-3 text-left">
          {/* Action buttons */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.3 }}
            className="flex gap-2"
          >
            <div className="flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium text-white/70">
              <Users className="h-3 w-3" />
              Members
            </div>
            <div className="flex items-center gap-1.5 rounded-md bg-positive px-3 py-1.5 text-xs font-semibold text-white">
              <Wallet className="h-3 w-3" />
              Settle
            </div>
          </motion.div>

          {/* Balances */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.3 }}
          >
            <p className="mb-1.5 text-sm font-semibold text-white">Balances</p>
            <div className="rounded-lg bg-white/5 p-3 space-y-2">
              <p className="text-xs font-semibold text-positive">
                You are owed $22.50
              </p>
              <div className="flex items-center gap-1.5 text-[11px] text-white/50">
                <UserAvatar userId="hero-alex" size="xs" />
                <span>Alex K owes $22.50</span>
              </div>
            </div>
          </motion.div>

          {/* Expenses */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Expenses</p>
                <p className="text-[10px] text-white/40">
                  All expenses and settlements
                </p>
              </div>
              <div className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[10px] text-white/50">
                <span>All</span>
              </div>
            </div>
            <div className="space-y-2">
              {heroExpenses.map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: 0.85 + i * 0.08,
                    duration: 0.3,
                    ease: [0.25, 0.46, 0.45, 0.94],
                  }}
                  className="rounded-lg bg-white/5 p-3"
                >
                  {/* Row 1: icon + label + amount */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <BanknoteArrowUp className="h-4 w-4 shrink-0 text-negative" />
                      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-white">
                        {item.label}
                      </span>
                    </div>
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-white">
                      {item.amount}
                    </span>
                  </div>
                  {/* Row 2: paid by */}
                  <div className="mt-1 flex items-center gap-1.5 text-[10px] text-white/50">
                    <span>Paid by</span>
                    <UserAvatar userId={item.paidById} size="xs" />
                    <span>{item.paidBy}</span>
                  </div>
                  {/* Row 3: time + your balance */}
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-[10px] text-white/40">
                      {item.timeAgo}
                    </span>
                    <span
                      className={`text-[10px] font-semibold tabular-nums ${item.owed ? "text-positive" : "text-negative"}`}
                    >
                      {item.owed ? "You're owed " : "You owe "}
                      {item.yourShare}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom nav */}
        <div className="flex items-center justify-around border-t border-white/5 px-2 py-2 pb-5">
          {[
            { label: "Friends", active: false },
            { label: "Tabs", active: true },
            { label: "plus", active: false },
            { label: "Activity", active: false },
            { label: "Me", active: false },
          ].map((item) =>
            item.label === "plus" ? (
              <div
                key="plus"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/40"
              >
                <span className="text-base font-light text-white leading-none">
                  +
                </span>
              </div>
            ) : (
              <div
                key={item.label}
                className={`flex flex-col items-center gap-0.5 ${item.active ? "text-primary" : "text-white/30"}`}
              >
                <span className="text-[9px] font-medium">{item.label}</span>
              </div>
            ),
          )}
        </div>
      </div>
    </motion.div>
  );
}

function FeatureShowcase() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section
      ref={ref}
      className="relative w-screen left-1/2 -ml-[50vw] border-t border-border/30 bg-background px-6 py-20 sm:px-8 sm:py-28 lg:px-12"
    >
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            How it works
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Built for how you actually split
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            The parts that make it actually pleasant to use.
          </p>
        </motion.div>

        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="relative overflow-hidden rounded-2xl border border-border/20 bg-card/50 p-8 dark:bg-card/30"
          >
            <motion.div
              className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary"
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
            >
              <Mic className="h-7 w-7" />
            </motion.div>
            <h3 className="font-semibold text-foreground">Voice expenses</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Say "Alex paid 30 for groceries in Roommates" and it's logged. AI
              parses who paid what.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="relative overflow-hidden rounded-2xl border border-border/20 bg-card/50 p-8 dark:bg-card/30"
          >
            <motion.div
              className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary"
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
            >
              <PieChart className="h-7 w-7" />
            </motion.div>
            <h3 className="font-semibold text-foreground">Flexible splits</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Equal by default, or dial in amounts, percentages, or shares when
              the bill wasn't fifty-fifty.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="relative overflow-hidden rounded-2xl border border-border/20 bg-card/50 p-8 dark:bg-card/30"
          >
            <motion.div
              className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary"
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
            >
              <QrCode className="h-7 w-7" />
            </motion.div>
            <motion.div
              className="absolute inset-0 rounded-2xl border-2 border-dashed border-primary/20"
              animate={{ opacity: [0.2, 0.5, 0.2] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <h3 className="font-semibold text-foreground">
              QR and link invites
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Invite friends or pull someone into a tab with a QR scan or a
              link. No usernames to hunt down.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.25, duration: 0.5 }}
            className="relative overflow-visible rounded-2xl border border-border/20 bg-card/50 p-8 dark:bg-card/30"
          >
            <motion.div
              className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary"
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
            >
              <Zap className="h-7 w-7" />
            </motion.div>
            <div className="flex items-center gap-3">
              <h3 className="font-semibold text-foreground">Real-time</h3>
              <span
                className="pointer-events-none relative flex h-3 w-3 shrink-0"
                aria-hidden
              >
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-chart-2 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-chart-2" />
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              New expense? You see who paid. Reactions, invites, and settlements
              too. Always in sync.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="relative overflow-hidden rounded-2xl border border-border/20 bg-card/50 p-8 dark:bg-card/30"
          >
            <motion.div
              className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary"
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
            >
              <CalendarClock className="h-7 w-7" />
            </motion.div>
            <h3 className="font-semibold text-foreground">
              Recurring expenses
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Weekly, monthly, or pick weekdays. Rent and subscriptions post on
              schedule. Pause, resume, or cap how many times it runs.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.35, duration: 0.5 }}
            className="relative overflow-hidden rounded-2xl border border-border/20 bg-card/50 p-8 dark:bg-card/30"
          >
            <motion.div
              className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary"
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
            >
              <BellRing className="h-7 w-7" />
            </motion.div>
            <h3 className="font-semibold text-foreground">Payment reminders</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              When someone owes you on a direct tab, send a push with a tone
              that matches the situation: from a light nudge to unmistakably
              clear.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function AnimatedSection({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{
        duration: 0.5,
        delay,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function HomePageContent() {
  useEffect(() => {
    if (typeof window === "undefined" || window.location.hash !== "#features") {
      return;
    }
    const id = window.setTimeout(() => {
      document.getElementById("features")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

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
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-size-[5rem_5rem] opacity-30 mask-[radial-gradient(ellipse_80%_70%_at_50%_0%,black_40%,transparent_100%)]" />
        <div className="mx-auto max-w-4xl text-center">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-xs font-medium uppercase tracking-widest text-muted-foreground"
          >
            Free Splitwise alternative
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-4 text-[2.75rem] font-bold tracking-[-0.04em] text-foreground sm:text-5xl md:text-[3.75rem] md:leading-[1.08]"
          >
            Split expenses with friends.{" "}
            <span className="bg-linear-to-r from-primary via-primary to-primary/70 bg-clip-text text-transparent">
              Without the limits.
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl"
          >
            Split bills with friends without dreading it. Tab is{" "}
            <span className="font-semibold text-foreground">free forever</span>.{" "}
            No limits, no upgrade prompts, no friction between you and knowing
            where you stand.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Button asChild size="lg" className="min-w-[200px]">
              <Link
                href={`${appConfig.pwaUrl}/login`}
                className="inline-flex items-center gap-2"
              >
                Get started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            {appConfig.githubUrl ? (
              <Button
                variant="outline"
                size="lg"
                asChild
                className="min-w-[140px]"
              >
                <Link
                  href={appConfig.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2"
                >
                  <Github className="h-4 w-4" />
                  Self host
                </Link>
              </Button>
            ) : null}
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.45,
              delay: 0.4,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
            className="mt-6 text-sm text-muted-foreground"
          >
            100% free hosted. Or self-host. No feature gates or limits.
          </motion.p>
          <HeroPreview />
        </div>
      </section>

      <section className="relative w-screen left-1/2 -ml-[50vw] border-t border-border/30 px-6 py-24 sm:px-8 sm:py-32 lg:px-12">
        <AnimatedSection className="mx-auto max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Why free?
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Because the paywall was a shitty experience.
          </h2>
          <div className="mt-6 space-y-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            <p>
              Splitwise used to be free. Then they introduced a paid plan and
              started nudging you toward it constantly, very annoyingly. Three
              expenses and you hit a limit. Now you have to wait for the timer
              to reset.
            </p>
            <p>
              It was supposed to an app for people, typically college students,
              travellers, and young couple, to help track their expenses. People
              who typically aren't flush with cash. It was a huge success, and
              then turned into a money-grab.
            </p>
            <p>
              Maybe the subscription is worth it for what the app does? Maybe
              it's not. But I hated this money-grab so much that it made me
              dread logging expenses, which meant I'd stop, lose track, and have
              no idea what I owed people or what they owed me.
            </p>
            <p>
              So I made this.{" "}
              <span className="font-medium text-foreground">
                Tab is free because I'd rather spend money on server costs than
                on a Splitwise subscription.
              </span>{" "}
              It doesn't cost much to run, really, and I hope people like using
              it to keep their finances in order.
            </p>
            <p>Like my partner and I do.</p>
            <p className="">
              -{" "}
              <Link
                href="https://www.parthkoshti.com?ref=tab"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline underline-offset-4 decoration-dotted text-foreground"
              >
                Parth Koshti
              </Link>
              , creator of Tab
            </p>
          </div>
          <div className="mt-6">
            <Button asChild size="lg" className="">
              <Link
                href={`${appConfig.pwaUrl}/login`}
                className="inline-flex items-center gap-2"
              >
                Try Now
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </AnimatedSection>
      </section>

      {/* <FeatureShowcase /> */}

      <section
        id="features"
        className="scroll-mt-24 relative w-screen left-1/2 -ml-[50vw] border-t border-border/30 bg-muted/5 px-6 py-24 sm:px-8 sm:py-32 lg:px-12"
      >
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Features
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Everything you need. Nothing you don't.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Voice logging, recurring splits, reminders when you're owed, and
              multi-currency expenses and settlements. Built for roommates,
              trips, and everyday bills.
            </p>
          </motion.div>
          <motion.div
            className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.06,
                  delayChildren: 0.1,
                },
              },
            }}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-40px" }}
          >
            {features.map(({ icon: Icon, title, description }) => (
              <motion.div
                key={title}
                variants={staggerChild}
                className="group rounded-xl border border-border/20 bg-card/50 p-6 transition-all duration-200 hover:border-border/40 hover:bg-card/80 hover:shadow-md dark:bg-card/30 dark:hover:bg-card/50"
              >
                <motion.div
                  className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15"
                  whileHover={{ scale: 1.05, rotate: 2 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  <Icon className="h-5 w-5" />
                </motion.div>
                <h3 className="mt-4 font-semibold text-foreground">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="relative w-screen left-1/2 -ml-[50vw] border-t border-border/30 px-6 py-24 sm:px-8 sm:py-32 lg:px-12">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 100%, rgba(94, 106, 210, 0.08), transparent 70%)",
          }}
        />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-xl text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Free. Forever.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
            No trial. No credit card. No plan to upgrade to.{" "}
            <span className="font-medium text-foreground">
              Tab is free because it has to be:
            </span>{" "}
            the moment logging an expense costs you something, you stop doing
            it.
          </p>
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button asChild size="lg" className="min-w-[180px]">
              <Link
                href={`${appConfig.pwaUrl}/login`}
                className="inline-flex items-center gap-2"
              >
                It's Free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            {appConfig.githubUrl ? (
              <Button variant="outline" size="lg" asChild>
                <Link
                  href={appConfig.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2"
                >
                  <Github className="h-4 w-4" />
                  Star on GitHub
                </Link>
              </Button>
            ) : null}
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            No credit card. No trial. Just free.
          </p>
        </motion.div>
      </section>
    </>
  );
}
