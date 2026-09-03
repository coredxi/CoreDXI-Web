import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const upsert = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { pageContent: { findUnique: (...a: unknown[]) => findUnique(...a), upsert: (...a: unknown[]) => upsert(...a) } },
}));

const { getPageContent, savePageContent } = await import("./page-content");
const { SOLUTIONS_CONTENT_DEFAULTS } = await import("./page-content/solutions");

const defaults = { title: "기본 제목", stats: [{ value: "1", label: "a" }] };

describe("getPageContent", () => {
  beforeEach(() => {
    findUnique.mockReset();
  });

  it("returns defaults when no row exists", async () => {
    findUnique.mockResolvedValue(null);
    const result = await getPageContent("home", defaults);
    expect(result).toEqual(defaults);
  });

  it("merges stored content over defaults", async () => {
    findUnique.mockResolvedValue({
      content: { title: "저장된 제목" },
    });
    const result = await getPageContent("home", defaults);
    expect(result).toEqual({ title: "저장된 제목", stats: defaults.stats });
  });

  it("fully replaces array fields present in stored content", async () => {
    findUnique.mockResolvedValue({
      content: { stats: [{ value: "2", label: "b" }] },
    });
    const result = await getPageContent("home", defaults);
    expect(result.stats).toEqual([{ value: "2", label: "b" }]);
  });

  it("fills brochureLabel/brochureUrl from defaults when a legacy stored solutions row lacks them", async () => {
    // [홍보팀] 신규 필드 추가 전 저장된 기존 PageContent JSON을 흉내낸다 —
    // brochureLabel/brochureUrl이 없어도 기본값과 병합돼 안전하게 채워져야 한다.
    const { brochureLabel, brochureUrl, ...legacyStoredContent } =
      SOLUTIONS_CONTENT_DEFAULTS;
    void brochureLabel;
    void brochureUrl;
    findUnique.mockResolvedValue({ content: legacyStoredContent });
    const result = await getPageContent("solutions", SOLUTIONS_CONTENT_DEFAULTS);
    expect(result.brochureLabel).toBe(SOLUTIONS_CONTENT_DEFAULTS.brochureLabel);
    expect(result.brochureUrl).toBe(SOLUTIONS_CONTENT_DEFAULTS.brochureUrl);
  });
});

describe("savePageContent", () => {
  it("upserts by page", async () => {
    upsert.mockResolvedValue({});
    await savePageContent("home", defaults);
    expect(upsert).toHaveBeenCalledWith({
      where: { page: "home" },
      create: { page: "home", content: defaults },
      update: { content: defaults },
    });
  });
});
