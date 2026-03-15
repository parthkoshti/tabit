import { notFound } from "next/navigation";
import { Link as TransitionLink } from "next-view-transitions";
import { MDXRemote } from "next-mdx-remote";
import { format } from "date-fns";
import type { Metadata } from "next";
import { getPostBySlug, getAllPosts } from "@/lib/blog";
import { mdxComponents } from "@/components/blog/mdx-components";
import { appConfig } from "@/app/config";

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) {
    return { title: "Post not found" };
  }
  return {
    title: {
      absolute: `${post.title} | ${appConfig.name} Blog`,
    },
    description: post.description,
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      url: `${appConfig.appUrl}/blog/${slug}`,
      siteName: appConfig.name,
    },
    alternates: {
      canonical: `${appConfig.appUrl}/blog/${slug}`,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  return (
    <>
      <section className="px-6 pt-32 pb-24 sm:px-8 sm:pt-40 sm:pb-32 lg:px-12">
        <div className="mx-auto max-w-2xl">
          <TransitionLink
            href="/blog"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Back to blog
          </TransitionLink>
          <h1 className="mt-8 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {post.title}
          </h1>
          {post.date ? (
            <time
              dateTime={post.date}
              className="mt-4 block text-base text-muted-foreground"
            >
              {format(new Date(post.date), "MMMM d, yyyy")}
            </time>
          ) : null}
        </div>
      </section>

      <section className="border-t border-border/50 px-6 py-16 sm:px-8 sm:py-24 lg:px-12">
        <article className="mx-auto max-w-2xl">
          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <MDXRemote {...post.mdxSource} components={mdxComponents} />
          </div>
        </article>
      </section>
    </>
  );
}
