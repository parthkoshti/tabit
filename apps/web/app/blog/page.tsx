import { Link as TransitionLink } from "next-view-transitions";
import { getAllPosts } from "@/lib/blog";
import { format } from "date-fns";

export default async function BlogPage() {
  const posts = await getAllPosts();

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
            Blog
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Updates, tips, and stories from the Tab team.
          </p>
        </div>
      </section>

      <section className="border-t border-border/50 px-6 py-16 sm:px-8 sm:py-24 lg:px-12">
        <div className="mx-auto max-w-2xl">
          <ul className="space-y-8">
            {posts.map((post) => (
              <li key={post.slug}>
                <TransitionLink
                  href={`/blog/${post.slug}`}
                  className="group block rounded-xl border border-border/40 bg-card/60 p-6 transition-colors hover:border-primary/25 hover:bg-card/90 dark:border-border/50 dark:bg-card/40 dark:hover:bg-card/60"
                >
                  <time
                    dateTime={post.date}
                    className="text-sm text-muted-foreground"
                  >
                    {post.date ? format(new Date(post.date), "MMMM d, yyyy") : ""}
                  </time>
                  <h2 className="mt-2 text-xl font-semibold text-foreground group-hover:text-primary">
                    {post.title}
                  </h2>
                  {post.description ? (
                    <p className="mt-2 text-base text-muted-foreground line-clamp-2">
                      {post.description}
                    </p>
                  ) : null}
                </TransitionLink>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
