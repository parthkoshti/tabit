"use client";

import Image from "next/image";
import Link from "next/link";
import { Link as TransitionLink } from "next-view-transitions";
import { appConfig } from "@/app/config";
import { Github, ArrowRight, Twitter, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";

function FooterLink({
  href,
  children,
  external = false,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  const className =
    "min-h-11 min-w-[44px] inline-flex items-center text-sm text-muted-foreground transition-colors hover:text-foreground -m-2 p-2 rounded-lg active:opacity-70";
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {children}
      </a>
    );
  }
  return (
    <TransitionLink href={href} className={className}>
      {children}
    </TransitionLink>
  );
}

function FooterSection({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <nav className="mt-4 flex flex-col gap-1" aria-label={title}>
        {children}
      </nav>
    </div>
  );
}

export function Footer() {
  const { creator } = appConfig;
  const currentYear = new Date().getFullYear();

  return (
    <footer
      role="contentinfo"
      className="border-t border-border/50 bg-muted/10 px-5 py-10 sm:px-6 sm:py-12 md:px-8 lg:px-12"
    >
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-2 gap-10 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          <div className="col-span-2 lg:col-span-1">
            <TransitionLink
              href="/"
              className="inline-flex items-center gap-3 transition-opacity hover:opacity-80"
            >
              <Image
                src="/icon-192x192.png"
                alt={appConfig.name}
                width={48}
                height={48}
                className="size-12 rounded-xl"
              />
            </TransitionLink>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              Splitting bills shouldn't cost you. No limits, no paywalls.
            </p>
            <Button asChild className="mt-4 gap-2">
              <Link href={`${appConfig.pwaUrl}/login`}>
                Get started
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          <FooterSection title="Product">
            <FooterLink href="/blog/why">Why Tab?</FooterLink>
            <FooterLink href="/support">Donate $5</FooterLink>
          </FooterSection>

          <FooterSection title="Connect">
            {appConfig.githubUrl ? (
              <FooterLink href={appConfig.githubUrl} external>
                <Github className="mr-2 h-4 w-4" />
                GitHub
              </FooterLink>
            ) : null}
            <FooterLink href={creator.website} external>
              <Globe className="mr-2 h-4 w-4" />
              {creator.name}
            </FooterLink>
            {creator.twitter ? (
              <FooterLink href={creator.twitter} external>
                <Twitter className="mr-2 h-4 w-4" />
                Twitter/X
              </FooterLink>
            ) : null}
          </FooterSection>

          {creator.otherProjects.length > 0 ? (
            <FooterSection title="Other projects">
              {creator.otherProjects.map((project) => (
                <FooterLink key={project.url} href={project.url} external>
                  {project.name}
                </FooterLink>
              ))}
            </FooterSection>
          ) : null}
        </div>

        <div className="mt-10 border-t border-border/50 pt-6 sm:mt-12 sm:pt-8">
          <p className="text-xs text-muted-foreground">
            Built with ❤️ by{" "}
            <a
              href={creator.website}
              target="_blank"
              rel="noopener"
              className="font-medium text-foreground transition-colors hover:text-primary"
            >
              {creator.name}
            </a>
            . Free forever.
          </p>
        </div>
      </div>
    </footer>
  );
}
