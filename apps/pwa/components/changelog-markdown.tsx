import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";

const markdownComponents: Components = {
  ul: ({ children, ...props }) => (
    <ul className="list-disc pl-6" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="list-decimal pl-6" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="my-0.5 text-muted-foreground" {...props}>
      {children}
    </li>
  ),
  h1: ({ children, ...props }) => (
    <h1 className="text-lg font-bold" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="text-base font-semibold" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="text-sm font-medium" {...props}>
      {children}
    </h3>
  ),
};

export function ChangelogMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown components={markdownComponents}>{children}</ReactMarkdown>
  );
}
