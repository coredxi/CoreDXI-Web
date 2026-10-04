import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const guardMock = { requireNewsletterAdmin: vi.fn(), requireCampaignManager: vi.fn() };
vi.mock("@/lib/newsletter/admin-guard", () => guardMock);
const collectCampaignMock = vi.fn();
vi.mock("@/lib/newsletter/collect/collect-campaign", () => ({ collectCampaign: (...a: unknown[]) => collectCampaignMock(...a) }));
const ensureCurrentIssueMock = vi.fn();
vi.mock("@/lib/newsletter/issues", () => ({ ensureCurrentIssue: (...a: unknown[]) => ensureCurrentIssueMock(...a) }));

const prismaMock = {
  newsletterCampaign: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
  newsletterKeyword: { deleteMany: vi.fn() },
  newsletterSelectionRule: { deleteMany: vi.fn() },
  newsletterCampaignSource: { deleteMany: vi.fn() },
  newsletterIssue: { count: vi.fn() },
  newsArticle: { upsert: vi.fn() },
  newsletterIssueArticle: { upsert: vi.fn(), count: vi.fn() },
  $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(prismaMock)),
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { addManualArticle, collectCampaignNow, deleteDraftCampaign, saveCampaign } = await import("./newsletter-campaigns");

const admin = { adminId: "adm1", role: "EDITOR", email: "me@coredxi.com" };
const input = {
  name: "AX 위클리",
  subjectTemplate: "(광고) t",
  sendType: "REVIEW_THEN_SEND" as const,
  cadence: "WEEKLY" as const,
  sendDayOfWeek: 2,
  sendHourKst: 8,
  activeFrom: "2026-10-06",
  activeUntil: "2026-12-31",
  collectDays: 7,
  maxArticles: 7,
  audience: "subscribers" as const,
  internalRecipients: [],
  keywords: [{ group: 1, operator: "OR" as const, term: "AI", weight: 3 }],
  rules: [],
  sourceIds: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  guardMock.requireNewsletterAdmin.mockResolvedValue({ ok: true, admin });
  guardMock.requireCampaignManager.mockResolvedValue({ ok: true, admin });
});

describe("saveCampaign", () => {
  it("권한이 없으면 저장하지 않는다", async () => {
    guardMock.requireNewsletterAdmin.mockResolvedValue({ ok: false, error: "권한 없음" });
    expect(await saveCampaign(input, { draft: false })).toEqual({ success: false, error: "권한 없음" });
    expect(prismaMock.newsletterCampaign.create).not.toHaveBeenCalled();
  });

  it("신규 캠페인은 로그인 관리자를 owner로, draft 플래그를 그대로 저장", async () => {
    prismaMock.newsletterCampaign.create.mockResolvedValue({ id: "c1" });
    const r = await saveCampaign(input, { draft: true });
    expect(r).toEqual({ success: true, id: "c1" });
    expect(prismaMock.newsletterCampaign.create.mock.calls[0][0].data).toMatchObject({ ownerId: "adm1", isDraft: true });
  });

  it("수정은 캠페인 담당자 게이트를 통과해야 한다", async () => {
    guardMock.requireCampaignManager.mockResolvedValue({ ok: false, error: "담당자만" });
    expect(await saveCampaign({ ...input, id: "c1" }, { draft: false })).toEqual({ success: false, error: "담당자만" });
  });

  it("RSS 매체 URL 검증과 별개로, 검증 실패 입력은 거부", async () => {
    expect((await saveCampaign({ ...input, keywords: [] }, { draft: false })).success).toBe(false);
  });
});

describe("deleteDraftCampaign", () => {
  it("임시저장이 아니거나 호가 있으면 삭제 거부", async () => {
    prismaMock.newsletterCampaign.findUnique.mockResolvedValue({ isDraft: false });
    expect((await deleteDraftCampaign("c1")).success).toBe(false);
    prismaMock.newsletterCampaign.findUnique.mockResolvedValue({ isDraft: true });
    prismaMock.newsletterIssue.count.mockResolvedValue(1);
    expect((await deleteDraftCampaign("c1")).success).toBe(false);
    expect(prismaMock.newsletterCampaign.delete).not.toHaveBeenCalled();
  });
});

describe("collectCampaignNow", () => {
  it("임시저장 캠페인은 수집하지 않는다", async () => {
    prismaMock.newsletterCampaign.findUnique.mockResolvedValue({ isDraft: true });
    expect(await collectCampaignNow("c1")).toEqual({ success: false, error: "임시저장 캠페인은 먼저 저장을 완료해 주세요" });
    expect(collectCampaignMock).not.toHaveBeenCalled();
  });

  it("담당자 게이트 후 수집 결과 요약을 돌려준다", async () => {
    prismaMock.newsletterCampaign.findUnique.mockResolvedValue({ isDraft: false });
    collectCampaignMock.mockResolvedValue({ fetched: 10, stored: 4, matched: 3, attached: 3, issueId: "i1", errors: [] });
    expect(await collectCampaignNow("c1")).toMatchObject({ success: true, attached: 3, issueId: "i1" });
  });
});

describe("addManualArticle", () => {
  it("http(s)가 아닌 URL·빈 제목 거부", async () => {
    expect((await addManualArticle("c1", { url: "javascript:x", title: "t", sourceName: "", publishedAt: "2026-10-05", snippet: "" })).success).toBe(false);
    expect((await addManualArticle("c1", { url: "https://a.com/1", title: " ", sourceName: "", publishedAt: "2026-10-05", snippet: "" })).success).toBe(false);
  });

  it("임시저장 캠페인에는 기사를 추가하지 않는다", async () => {
    prismaMock.newsletterCampaign.findUnique.mockResolvedValue({ id: "c1", isDraft: true });
    const r = await addManualArticle("c1", { url: "https://a.com/1", title: "t", sourceName: "", publishedAt: "2026-10-05", snippet: "" });
    expect(r).toEqual({ success: false, error: "임시저장 캠페인은 먼저 저장을 완료해 주세요" });
    expect(ensureCurrentIssueMock).not.toHaveBeenCalled();
  });

  it("기사를 저장하고 현재 호에 선택된 후보로 붙인다", async () => {
    prismaMock.newsletterCampaign.findUnique.mockResolvedValue({
      id: "c1", sendType: "REVIEW_THEN_SEND", subjectTemplate: "t", cadence: "WEEKLY", sendDayOfWeek: 2, sendHourKst: 8,
      activeFrom: new Date("2026-10-01T00:00:00Z"), activeUntil: null,
    });
    ensureCurrentIssueMock.mockResolvedValue({ id: "i1", status: "DRAFT", editedAt: null });
    prismaMock.newsArticle.upsert.mockResolvedValue({ id: "a1" });
    prismaMock.newsletterIssueArticle.count.mockResolvedValue(2);
    const r = await addManualArticle("c1", { url: "https://a.com/1", title: "직접 추가", sourceName: "블로터", publishedAt: "2026-10-05", snippet: "요약" });
    expect(r).toEqual({ success: true, issueId: "i1" });
    expect(prismaMock.newsletterIssueArticle.upsert.mock.calls[0][0].create).toMatchObject({ issueId: "i1", articleId: "a1", isSelected: true, sortOrder: 2 });
  });
});
