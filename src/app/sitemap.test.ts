import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    blogPost: { findMany: vi.fn().mockResolvedValue([]) },
    portfolio: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

const listPublicBlogCategoriesMock = vi.fn();
vi.mock("@/lib/blog-categories", () => ({
  listPublicBlogCategories: () => listPublicBlogCategoriesMock(),
}));

import sitemap from "./sitemap";

describe("sitemap — 블로그 카테고리", () => {
  it("공개 글이 있는 카테고리(listPublicBlogCategories 결과)만 포함한다", async () => {
    listPublicBlogCategoriesMock.mockResolvedValue([
      {
        id: "c1",
        name: "AI 실무 활용",
        slug: "ai-practice",
        description: null,
        sortOrder: 0,
        updatedAt: new Date("2026-10-01"),
      },
    ]);

    const urls = (await sitemap()).map((entry) => entry.url);
    const categoryUrls = urls.filter((url) => url.includes("/blog/category/"));

    expect(categoryUrls).toHaveLength(1);
    expect(categoryUrls[0]).toMatch(/\/blog\/category\/ai-practice$/);
  });
});
