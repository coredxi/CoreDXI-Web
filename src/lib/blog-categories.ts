import { prisma } from "@/lib/prisma";

export type BlogCategoryItem = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
};

export async function listBlogCategories(): Promise<BlogCategoryItem[]> {
  return prisma.blogCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      sortOrder: true,
    },
  });
}

export async function getBlogCategoryBySlug(slug: string) {
  return prisma.blogCategory.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
    },
  });
}

/** 공개 글 수가 1개 이상인 카테고리만 남긴다(빈 카테고리 숨김, 2026-10-26 결정 A안). */
export function filterNonEmptyCategories<T extends { publishedCount: number }>(
  categories: T[]
): T[] {
  return categories.filter((c) => c.publishedCount > 0);
}

/**
 * 공개 블로그 사이드바용 카테고리 목록 — 발행(PUBLISHED) 글이 없는 카테고리는 숨긴다.
 * 관리자 CMS는 listBlogCategories()를 그대로 써서 모든 카테고리를 본다.
 * 빈 카테고리도 직접 URL(/blog/category/{slug})로는 기존 빈 상태 화면이 보인다(404 아님).
 */
export async function listPublicBlogCategories(): Promise<BlogCategoryItem[]> {
  const rows = await prisma.blogCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      sortOrder: true,
      _count: { select: { posts: { where: { status: "PUBLISHED" } } } },
    },
  });
  const withCounts = rows.map(({ _count, ...category }) => ({
    category,
    publishedCount: _count.posts,
  }));
  return filterNonEmptyCategories(withCounts).map((row) => row.category);
}
