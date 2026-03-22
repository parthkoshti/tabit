import Link from "next/link";
import { appConfig } from "@/app/config";
import { Button } from "@/components/ui/button";
import { Github, ExternalLink, Heart, ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Support Tab",
  description:
    "Tab is free forever. If it's saved you from a paywall, a $5 donation helps keep the servers running.",
};

const donateLinks = [
  {
    name: "PayPal",
    url: appConfig.support.paypalUrl,
  },
  {
    name: "Venmo",
    url: appConfig.support.venmoUrl,
  },
];

export default function SupportPage() {
  return (
    <>
      <section className="px-6 pt-32 pb-20 sm:px-8 sm:pt-40 sm:pb-28 lg:px-12">
        <div className="mx-auto max-w-xl">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>

          <h1 className="mt-8 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Tab is free. It'll stay that way.
          </h1>
          <div className="mt-6 space-y-4 text-base leading-relaxed text-muted-foreground">
            <p>
              No limits, no upgrade prompts, no paywall. I built Tab because
              Splitwise got greedy and I got tired of it. The whole point is
              that logging an expense should cost you nothing. In money, in
              friction, in guilt.
            </p>
            <p>
              I cover the infrastructure costs myself. I have other projects
              that pay the bills, so Tab doesn't need to make money.
            </p>
            <p>
              But if Tab has saved you from a paywall or just made splitting
              bills with your friends a little less annoying, a small donation
              means a lot. It helps cover hosting and keeps me motivated to keep
              building.
            </p>
            <p className="font-medium text-foreground">
              Completely optional. The app works exactly the same either way.
            </p>
          </div>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            {donateLinks.map((link) => (
              <a
                key={link.name}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-1 items-center justify-between gap-3 rounded-xl border border-border/40 bg-card/60 px-5 py-4 transition-all hover:border-primary/30 hover:bg-card/90 hover:shadow-sm dark:bg-card/30 dark:hover:bg-card/50"
              >
                <div>
                  <p className="font-semibold text-foreground">{link.name}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Donate $5
                  </p>
                </div>
                <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
              </a>
            ))}
          </div>

          {appConfig.githubUrl ? (
            <div className="mt-10 rounded-xl border border-border/30 bg-muted/20 p-5 dark:bg-muted/10">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Github className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">
                    Not a money person? That's fine too.
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    A GitHub star, a bug report, or a PR helps just as much. Tab
                    is open source. Contributions are always welcome.
                  </p>
                  <Button variant="outline" size="sm" className="mt-3" asChild>
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
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="border-t border-border/50 px-6 py-10 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-xl">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Heart className="h-4 w-4 shrink-0 fill-current text-primary/60" />
            Thanks for using Tab. It genuinely means a lot.
          </p>
        </div>
      </section>
    </>
  );
}
