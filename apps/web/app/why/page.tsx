"use client";

import { Button } from "@/components/ui/button";
import { appConfig } from "@/app/config";
import { ArrowRight, ExternalLink } from "lucide-react";
import { Link as TransitionLink } from "next-view-transitions";

export default function WhyPage() {
  return (
    <>
      <section className="px-6 pt-32 pb-24 sm:px-8 sm:pt-40 sm:pb-32 lg:px-12">
        <div className="mx-auto max-w-2xl">
          <TransitionLink
            href="/"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Back to home
          </TransitionLink>
          <h1 className="mt-8 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Why Tab exists
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            The short version: expense apps got greedy. Tab is the antidote.
          </p>
        </div>
      </section>

      <section className="border-t border-border/50 px-6 py-16 sm:px-8 sm:py-24 lg:px-12">
        <div className="mx-auto max-w-2xl space-y-12">
          <div>
            <h2 className="text-xl font-semibold text-foreground sm:text-2xl">
              The problem
            </h2>
            <div className="mt-6 space-y-4 text-base leading-relaxed text-muted-foreground">
              <p>
                Splitwise used to be simple. Add expenses, split with friends,
                settle up. Then they added a daily cap. Three expenses, then a
                timer. Then a paywall. The basics got locked behind a
                subscription.
              </p>
              <p>
                That pattern is everywhere now. Free tiers that feel like demos.
                Artificial limits that push you toward upgrades. Dark patterns
                that make you feel like you're doing something wrong for wanting
                to split a fourth expense.
              </p>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-foreground sm:text-2xl">
              What Tab does differently
            </h2>
            <div className="mt-6 space-y-4 text-base leading-relaxed text-muted-foreground">
              <p>
                No daily cap. No wait timer. No upgrade prompt when you add your
                tenth expense. Create as many tabs as you want. Add as many
                friends as you need. Settle up when you're ready.
              </p>
              <p>
                Tab is open source. Your data, your control. No lock-in, no
                surprise limits. If the product changes in a way you don't like,
                the code is there. The community can fork it.
              </p>
              <p>
                Splitting bills shouldn't cost you. Not in money, not in
                friction, not in guilt. Tab exists because that should be the
                default.
              </p>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-foreground sm:text-2xl">
              Built for people who split bills, not paywalls
            </h2>
            <div className="mt-6 space-y-4 text-base leading-relaxed text-muted-foreground">
              <p>
                Roommates, trip mates, office lunch crews. The use case is
                simple. The tools should be too. Tab gives you tabs, friends,
                expenses, and settle-up. Nothing more, nothing less.
              </p>
            </div>
          </div>
        </div>
      </section>

      {appConfig.creator.otherProjects.length > 0 ? (
        <section className="border-t border-border/50 px-6 py-16 sm:px-8 sm:py-24 lg:px-12">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-xl font-semibold text-foreground sm:text-2xl">
              Other projects
            </h2>
            <p className="mt-2 text-muted-foreground">
              Check out my other projects.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {appConfig.creator.otherProjects.map((project) => (
                <a
                  key={project.url}
                  href={project.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-border/40 bg-card/60 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:border-primary/25 hover:bg-card/90 dark:border-border/50 dark:bg-card/40 dark:hover:bg-card/60"
                >
                  {project.name}
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </a>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="border-t border-border/50 px-6 py-24 sm:px-8 sm:py-32 lg:px-12">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Ready to split?
          </h2>
          <p className="mt-4 text-muted-foreground">
            No credit card. No expense limit. No wait timer.
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
