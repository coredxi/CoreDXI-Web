import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  newsletterCampaign: { findUnique: vi.fn() },
  newsSource: { findMany: vi.fn() },
  newsArticle: { findMany: vi.fn(), upsert: vi.fn() },
  newsletterIssueArticle: { findMany: vi.fn(), deleteMany: vi.fn(), upsert: vi.fn() },
  newsletterIssue: { findFirst: vi.fn(), updateMany: vi.fn() },
  $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prismaMock)),
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const ensureCurrentIssueMock = vi.fn();
vi.mock("../issues", () => ({ ensureCurrentIssue: (...a: unknown[]) => ensureCurrentIssueMock(...a) }));

const { collectCampaign } = await import("./collect-campaign");

const NOW = new Date("2026-10-05T03:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

const campaign = {
  id: "c1",
  sendType: "REVIEW_THEN_SEND",
  subjectTemplate: "(광고) t",
  cadence: "WEEKLY",
  sendDayOfWeek: 2,
  sendHourKst: 8,
  activeFrom: new Date("2026-10-01T00:00:00Z"),
  activeUntil: null,
  collectDays: 7,
  maxArticles: 2,
  keywords: [
    { group: 1, operator: "OR", term: "AI 도입", weight: 5 },
    { group: 2, operator: "OR", term: "중소기업", weight: 5 },
    { group: 0, operator: "NOT", term: "주가", weight: 1 },
  ],
  sources: [{ source: { id: "s1", rssUrl: "https://rss.etnews.com/a.xml", isActive: true } }],
};

let upsertSeq = 0;
beforeEach(() => {
  vi.clearAllMocks();
  upsertSeq = 0;
  prismaMock.newsletterCampaign.findUnique.mockResolvedValue(campaign);
  prismaMock.newsSource.findMany.mockResolvedValue([{ id: "s1", domain: "etnews.com", trustWeight: 5 }]);
  prismaMock.newsArticle.findMany.mockResolvedValue([]);
  prismaMock.newsArticle.upsert.mockImplementation(async ({ create }: { create: Record<string, unknown> }) => ({
    id: `a${++upsertSeq}`,
    ...create,
    source: create.sourceId ? { trustWeight: 5 } : null,
  }));
  prismaMock.newsletterIssueArticle.findMany.mockResolvedValue([]);
  prismaMock.newsletterIssue.findFirst.mockResolvedValue({ id: "i1" });
  ensureCurrentIssueMock.mockResolvedValue({ id: "i1", status: "COLLECTING", editedAt: null });
});

function deps(naver: unknown[], rss: unknown[] = []) {
  return {
    searchNaver: vi.fn().mockResolvedValue(naver),
    fetchRss: vi.fn().mockResolvedValue(rss),
  };
}

const art = (title: string, url: string, h = 1, origin = "NAVER_API") => ({
  title,
  snippet: null,
  originalUrl: url,
  publishedAt: hoursAgo(h),
  origin,
});

describe("collectCampaign", () => {
  it("가장 작은 포함 그룹 용어로만 네이버를 질의하고 활성 RSS를 읽는다", async () => {
    const d = deps([]);
    await collectCampaign("c1", { now: NOW, deps: d });
    expect(d.searchNaver).toHaveBeenCalledTimes(1);
    expect(d.searchNaver).toHaveBeenCalledWith("AI 도입");
    expect(d.fetchRss).toHaveBeenCalledWith("https://rss.etnews.com/a.xml");
  });

  it("URL 중복·전재(같은 제목 해시)를 하나로 묶고 키워드 탈락·기간 밖 기사는 붙이지 않는다", async () => {
    const d = deps(
      [
        art("중소기업 AI 도입 확산", "https://www.etnews.com/1?utm_source=naver", 2),
        art("중소기업 AI 도입 확산 - 매일경제", "https://www.mk.co.kr/9", 1), // 전재(더 늦음) → 제외
        art("대기업 AI 도입", "https://a.com/3"), // 그룹2 탈락
        art("중소기업 AI 도입 관련 주가 급등", "https://a.com/4"), // 제외어
        art("중소기업 AI 도입 옛날 기사", "https://a.com/5", 24 * 10), // 기간 밖
      ],
      [art("중소기업 AI 도입 확산", "https://etnews.com/1", 2, "RSS")] // URL 중복
    );
    const result = await collectCampaign("c1", { now: NOW, deps: d });

    expect(prismaMock.newsArticle.upsert).toHaveBeenCalledTimes(3); // 확산·대기업·주가 (옛날 기사는 저장 전 컷)
    expect(result.matched).toBe(1);
    expect(result.attached).toBe(1);
    const created = prismaMock.newsArticle.upsert.mock.calls[0][0].create;
    expect(created.urlNormalized).toBe("https://etnews.com/1");
    expect(created.sourceId).toBe("s1");
  });

  it("상위 maxArticles는 선택, maxArticles×2까지 후보로 붙인다", async () => {
    const d = deps([
      art("중소기업 AI 도입 1", "https://www.etnews.com/1", 1),
      art("중소기업 AI 도입 2", "https://www.etnews.com/2", 2),
      art("중소기업 AI 도입 3", "https://www.etnews.com/3", 3),
      art("중소기업 AI 도입 4", "https://www.etnews.com/4", 4),
      art("중소기업 AI 도입 5", "https://www.etnews.com/5", 5),
    ]);
    const result = await collectCampaign("c1", { now: NOW, deps: d });
    expect(result.attached).toBe(4);
    const upserts = prismaMock.newsletterIssueArticle.upsert.mock.calls.map((c) => c[0].create);
    expect(upserts.filter((u: { isSelected: boolean }) => u.isSelected)).toHaveLength(2);
    expect(prismaMock.newsletterIssue.updateMany).toHaveBeenCalledWith({
      where: { id: "i1", status: { in: ["COLLECTING", "DRAFT"] }, editedAt: null },
      data: { status: "DRAFT" },
    });
  });

  it("검토요청(REVIEW_REQUESTED) 호는 후보·상태를 건드리지 않는다", async () => {
    ensureCurrentIssueMock.mockResolvedValue({ id: "i1", status: "REVIEW_REQUESTED", editedAt: null });
    const result = await collectCampaign("c1", { now: NOW, deps: deps([art("중소기업 AI 도입 1", "https://www.etnews.com/1")]) });
    expect(result.issueId).toBe("i1");
    expect(result.attached).toBe(0);
    expect(prismaMock.newsletterIssueArticle.upsert).not.toHaveBeenCalled();
    expect(prismaMock.newsletterIssue.updateMany).not.toHaveBeenCalled();
  });

  it("트랜잭션 안 재확인에서 호가 더 이상 편집 가능하지 않으면(동시 승인) 아무것도 쓰지 않는다", async () => {
    prismaMock.newsletterIssue.findFirst.mockResolvedValue(null);
    const result = await collectCampaign("c1", { now: NOW, deps: deps([art("중소기업 AI 도입 1", "https://www.etnews.com/1")]) });
    expect(result.attached).toBe(0);
    expect(prismaMock.newsletterIssueArticle.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.newsletterIssueArticle.upsert).not.toHaveBeenCalled();
    expect(prismaMock.newsletterIssue.updateMany).not.toHaveBeenCalled();
  });

  it("미래 날짜(now+2h) 기사는 저장하지 않는다", async () => {
    const future = { ...art("중소기업 AI 도입 미래", "https://www.etnews.com/f"), publishedAt: new Date(NOW.getTime() + 2 * 3_600_000) };
    await collectCampaign("c1", { now: NOW, deps: deps([future]) });
    expect(prismaMock.newsArticle.upsert).not.toHaveBeenCalled();
  });

  it("지난 SENT 호에 실렸던 기사는 후보에서 제외한다", async () => {
    prismaMock.newsletterIssueArticle.findMany.mockImplementation(async (args: { where: { issue?: unknown } }) =>
      args.where.issue ? [{ articleId: "a1" }] : []
    );
    const d = deps([art("중소기업 AI 도입 1", "https://www.etnews.com/1")]);
    const result = await collectCampaign("c1", { now: NOW, deps: d });
    expect(result.attached).toBe(0);
    expect(prismaMock.newsletterIssueArticle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isSelected: true, issue: { campaignId: "c1", status: "SENT" } }),
      })
    );
  });

  it("관리자가 편집한 호(editedAt)는 기사만 저장하고 후보를 건드리지 않는다", async () => {
    ensureCurrentIssueMock.mockResolvedValue({ id: "i1", status: "DRAFT", editedAt: new Date() });
    const d = deps([art("중소기업 AI 도입 1", "https://www.etnews.com/1")]);
    const result = await collectCampaign("c1", { now: NOW, deps: d });
    expect(prismaMock.newsArticle.upsert).toHaveBeenCalledTimes(1);
    expect(prismaMock.newsletterIssueArticle.upsert).not.toHaveBeenCalled();
    expect(result.attached).toBe(0);
  });

  it("네이버·RSS 한쪽이 실패해도 나머지로 계속하고 errors에 남긴다", async () => {
    const d = {
      searchNaver: vi.fn().mockRejectedValue(new Error("HTTP 429")),
      fetchRss: vi.fn().mockResolvedValue([art("중소기업 AI 도입 R", "https://www.etnews.com/r", 1, "RSS")]),
    };
    const result = await collectCampaign("c1", { now: NOW, deps: d });
    expect(result.errors).toEqual([expect.stringContaining("HTTP 429")]);
    expect(result.attached).toBe(1);
  });

  it("DB에 같은 제목 해시 기사가 이미 있으면 새로 만들지 않고 기존 기사를 쓴다", async () => {
    const { computeTitleHash } = await import("../normalize");
    prismaMock.newsArticle.findMany.mockResolvedValue([
      { id: "old", titleHash: computeTitleHash("중소기업 AI 도입 확산"), urlNormalized: "https://mk.co.kr/old", title: "중소기업 AI 도입 확산", snippet: null, publishedAt: hoursAgo(5), source: null },
    ]);
    const d = deps([art("중소기업 AI 도입 확산", "https://www.etnews.com/1")]);
    const result = await collectCampaign("c1", { now: NOW, deps: d });
    expect(prismaMock.newsArticle.upsert).not.toHaveBeenCalled();
    expect(result.attached).toBe(1);
    expect(prismaMock.newsletterIssueArticle.upsert.mock.calls[0][0].create.articleId).toBe("old");
  });

  it("없는 캠페인은 예외 없이 오류 결과", async () => {
    prismaMock.newsletterCampaign.findUnique.mockResolvedValue(null);
    const result = await collectCampaign("nope", { now: NOW, deps: deps([]) });
    expect(result.errors).toEqual(["캠페인을 찾을 수 없습니다."]);
  });
});
