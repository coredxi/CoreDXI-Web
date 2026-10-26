import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { filterNonEmptyCategories } from "./blog-categories";

describe("filterNonEmptyCategories", () => {
  it("공개 글이 0개인 카테고리는 숨긴다", () => {
    const categories = [
      { slug: "ai-practice", publishedCount: 4 },
      { slug: "company-news", publishedCount: 0 },
      { slug: "case-notes", publishedCount: 1 },
    ];
    expect(filterNonEmptyCategories(categories).map((c) => c.slug)).toEqual([
      "ai-practice",
      "case-notes",
    ]);
  });

  it("모두 비어 있으면 빈 목록", () => {
    expect(filterNonEmptyCategories([{ publishedCount: 0 }])).toEqual([]);
  });
});
