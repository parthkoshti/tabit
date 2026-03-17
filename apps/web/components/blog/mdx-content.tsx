"use client";

import { MDXRemote } from "next-mdx-remote";
import type { BlogPost } from "@/lib/blog";
import { mdxComponents } from "./mdx-components";

interface MDXContentProps {
  source: BlogPost["mdxSource"];
}

export function MDXContent({ source }: MDXContentProps) {
  return <MDXRemote {...source} components={mdxComponents} />;
}
