import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { serialize } from "next-mdx-remote/serialize";

const BLOG_DIR = path.join(process.cwd(), "content", "blog");

export interface BlogPostMeta {
  slug: string;
  title: string;
  description: string;
  date: string;
}

export interface BlogPost extends BlogPostMeta {
  frontmatter: Record<string, unknown>;
  mdxSource: Awaited<ReturnType<typeof serialize>>;
}

export async function getAllPosts(): Promise<BlogPostMeta[]> {
  const files = await readdir(BLOG_DIR);
  const mdxFiles = files.filter((f) => f.endsWith(".mdx"));

  const posts: BlogPostMeta[] = await Promise.all(
    mdxFiles.map(async (filename) => {
      const slug = filename.replace(/\.mdx$/, "");
      const filePath = path.join(BLOG_DIR, filename);
      const raw = await readFile(filePath, "utf-8");
      const { data } = matter(raw);
      return {
        slug,
        title: (data.title as string) ?? slug,
        description: (data.description as string) ?? "",
        date: (data.date as string) ?? "",
      };
    })
  );

  return posts.sort((a, b) => (b.date > a.date ? 1 : -1));
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const filePath = path.join(BLOG_DIR, `${slug}.mdx`);
  try {
    const raw = await readFile(filePath, "utf-8");
    const { data: frontmatter, content } = matter(raw);
    const mdxSource = await serialize(content);

    return {
      slug,
      title: (frontmatter.title as string) ?? slug,
      description: (frontmatter.description as string) ?? "",
      date: (frontmatter.date as string) ?? "",
      frontmatter: frontmatter as Record<string, unknown>,
      mdxSource,
    };
  } catch {
    return null;
  }
}
