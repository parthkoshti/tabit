import { Link as TransitionLink } from "next-view-transitions";
import { appConfig } from "@/app/config";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Github, ExternalLink, Heart } from "lucide-react";

const donateLinks = [
  {
    name: "PayPal",
    description: "Any amount helps.",
    url: appConfig.support.paypalUrl,
    cta: "Donate $5",
  },
  {
    name: "Venmo",
    description: "Quick send from your phone.",
    url: appConfig.support.venmoUrl,
    cta: "Donate $5",
  },
];

export const metadata = {
  title: "Donate $5",
  description:
    "Support Tab development. No limits, no paywall—a small donation helps keep it that way.",
};

export default function SupportPage() {
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
            Donate $5
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Tab has no limits, no paywall, no timer. A small donation helps keep
            it that way.
          </p>
          <div className="mt-8 space-y-4 text-base leading-relaxed text-muted-foreground">
            <p>
              The app is free forever because I built it that way. No cap on
              expenses, no upgrade prompts, no dark patterns. If Tab has saved
              you from splitting another bill manually—or from hitting a paywall
              elsewhere—a $5 donation goes a long way.
            </p>
            <p>
              Your support keeps the servers running and the lights on. No VC
              money, no ads, no data sales. Just a simple app that does one
              thing well.
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-border/50 px-6 py-16 sm:px-8 sm:py-24 lg:px-12">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Choose how to donate
          </p>
          <h2 className="mt-3 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            PayPal or Venmo
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {donateLinks.map((link) => (
              <a
                key={link.name}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block"
              >
                <Card className="h-full transition-all hover:border-primary/30 hover:bg-card/90 hover:shadow-md dark:hover:bg-card/70">
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                    <CardTitle className="text-base">{link.name}</CardTitle>
                    <ExternalLink className="h-4 w-4 shrink-0 opacity-50 transition-opacity group-hover:opacity-100" />
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <CardDescription>{link.description}</CardDescription>
                    <span className="inline-flex h-9 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground">
                      {link.cta}
                    </span>
                  </CardContent>
                </Card>
              </a>
            ))}
          </div>

          {appConfig.githubUrl ? (
            <div className="mt-12 rounded-xl border border-border/40 bg-muted/20 p-6 dark:bg-muted/10">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Github className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">
                    Prefer to contribute?
                  </h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Star the repo, report issues, or open a PR. Every bit helps.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 rounded-xl"
                asChild
              >
                <a
                  href={appConfig.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2"
                >
                  <Github className="h-4 w-4" />
                  View on GitHub
                </a>
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      <section className="border-t border-border/50 px-6 py-12 sm:px-8 sm:py-16 lg:px-12">
        <div className="mx-auto max-w-2xl text-center">
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Heart className="h-4 w-4 fill-current text-primary/60" />
            Thanks for using Tab.
          </p>
        </div>
      </section>
    </>
  );
}
