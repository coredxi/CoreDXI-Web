import { listPublicBlogCategories } from "@/lib/blog-categories";
import { BlogShell } from "@/components/blog/BlogShell";

export const revalidate = 60;

export default async function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const categories = await listPublicBlogCategories();
  return <BlogShell categories={categories}>{children}</BlogShell>;
}
