import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import type { BlogCategoryItem } from "@/lib/blog-categories";
import { BlogSidebar } from "./BlogSidebar";

type Props = {
  categories: BlogCategoryItem[];
  children: React.ReactNode;
};

export function BlogShell({ categories, children }: Props) {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-background pt-24 pb-16">
        <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 lg:flex-row lg:gap-12 lg:px-8">
          <BlogSidebar categories={categories} />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </main>
      <Footer />
    </>
  );
}
