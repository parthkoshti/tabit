import { Link as TransitionLink } from "next-view-transitions";

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
};
