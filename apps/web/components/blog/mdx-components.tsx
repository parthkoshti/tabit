import { Link as TransitionLink } from "next-view-transitions";
import { appConfig } from "@/app/config";
import { Button } from "@/components/ui/button";
import { ArrowRight, ExternalLink } from "lucide-react";
import Link from "next/link";

const headingClasses = {
  h1: "mt-8 text-3xl font-bold tracking-tight text-foreground sm:text-4xl",
  h2: "mt-12 text-xl font-semibold text-foreground sm:text-2xl",
  h3: "mt-8 text-lg font-semibold text-foreground",
};

export const mdxComponents = {
  a: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
    const isExternal = href?.startsWith("http");
    if (isExternal) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary underline underline-offset-4 transition-colors hover:text-primary/80"
          {...props}
        >
          {children}
        </a>
      );
    }
    return (
      <TransitionLink
        href={href ?? "#"}
        className="font-medium text-primary underline underline-offset-4 transition-colors hover:text-primary/80"
        {...props}
      >
        {children}
      </TransitionLink>
    );
  },
  h1: ({ children }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 className={headingClasses.h1}>{children}</h1>
  ),
  h2: ({ children }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className={headingClasses.h2}>{children}</h2>
  ),
  h3: ({ children }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className={headingClasses.h3}>{children}</h3>
  ),
  p: ({ children }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="mt-4 text-base leading-relaxed text-muted-foreground">
      {children}
    </p>
  ),
  ul: ({ children }: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="mt-4 list-disc space-y-2 pl-6 text-base leading-relaxed text-muted-foreground">
      {children}
    </ul>
  ),
  ol: ({ children }: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="mt-4 list-decimal space-y-2 pl-6 text-base leading-relaxed text-muted-foreground">
      {children}
    </ol>
  ),
  li: ({ children }: React.HTMLAttributes<HTMLLIElement>) => (
    <li className="leading-relaxed">{children}</li>
  ),
  code: ({ children }: React.HTMLAttributes<HTMLElement>) => (
    <code className="rounded border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-sm">
      {children}
    </code>
  ),
  pre: ({ children }: React.HTMLAttributes<HTMLPreElement>) => (
    <pre className="mt-4 overflow-x-auto rounded-lg border border-border bg-muted/30 p-4">
      {children}
    </pre>
  ),
  blockquote: ({ children }: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote className="mt-4 border-l-4 border-primary/50 pl-4 italic text-muted-foreground">
      {children}
    </blockquote>
  ),
  OtherProjects: () => {
    const projects = appConfig.creator.otherProjects as readonly {
      name: string;
      url: string;
    }[];
    if (projects.length === 0) return null;
    return (
      <div className="mt-12">
        <h2 className={headingClasses.h2}>Other projects</h2>
        <p className="mt-2 text-muted-foreground">
          Check out my other projects.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {projects.map((project) => (
            <a
              key={project.url}
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-border/40 bg-card/60 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:border-primary/25 hover:bg-card/90 dark:border-border/50 dark:bg-card/40 dark:hover:bg-card/60 no-underline"
            >
              {project.name}
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            </a>
          ))}
        </div>
      </div>
    );
  },
  GetStartedButton: () => (
    <div className="mt-12 text-center">
      <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        Ready to split?
      </h2>
      <p className="mt-4 text-muted-foreground">
        No credit card. No expense limit. No wait timer.
      </p>
      <Button
        asChild
        size="lg"
        className="mt-10 rounded-full px-10 shadow-lg shadow-primary/20 no-underline"
      >
        <Link href={`${appConfig.pwaUrl}/login`} target="_blank">
          Create your first tab
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  ),
};
