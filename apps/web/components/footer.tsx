"use client";

import Image from "next/image";
import { Link as TransitionLink } from "next-view-transitions";
import { appConfig } from "@/app/config";
import { Github, ArrowRight, Twitter, Globe } from "lucide-react";

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
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-2 sm:gap-10 lg:grid-cols-4 lg:gap-8">
          <div className="col-span-2 sm:col-span-2 lg:col-span-1">
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
            <a
              href={`${appConfig.pwaUrl}/login`}
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Get started
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>

          <FooterSection title="Product">
            <FooterLink href="/blog/why">Why Tab?</FooterLink>
          </FooterSection>

          <FooterSection title="Connect">
            {appConfig.githubUrl ? (
              <FooterLink href={appConfig.githubUrl} external>
                <Github className="mr-2 h-4 w-4" />
                Star on GitHub
              </FooterLink>
            ) : null}

            <FooterLink href={creator.website} external>
              <Globe className="mr-2 h-4 w-4" /> {creator.name}
            </FooterLink>
            {creator.twitter ? (
              <FooterLink href={creator.twitter} external>
                <Twitter className="mr-2 h-4 w-4" /> Twitter/X
              </FooterLink>
            ) : null}
          </FooterSection>

          {creator.otherProjects.length > 0 ? (
            <FooterSection title="Other projects" className="col-span-2">
              {creator.otherProjects.map((project) => (
                <FooterLink key={project.url} href={project.url} external>
                  {project.name}
                </FooterLink>
              ))}
            </FooterSection>
          ) : null}
        </div>

        <div className="mt-10 flex flex-col items-center gap-3 border-t border-border/50 pt-6 sm:mt-12 sm:flex-row sm:justify-between sm:pt-8">
          <p className="text-center text-xs text-muted-foreground sm:text-left">
            &copy; {currentYear} {creator.name}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
