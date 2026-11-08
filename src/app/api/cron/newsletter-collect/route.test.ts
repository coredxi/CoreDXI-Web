import { beforeEach, describe, expect, it, vi } from "vitest";

const collectCampaignMock = vi.fn();
vi.mock("@/lib/newsletter/collect/collect-campaign", () => ({
  collectCampaign: (...a: unknown[]) => collectCampaignMock(...a),
}));
const captureMessageMock = vi.fn();
vi.mock("@sentry/nextjs", () => ({ captureMessage: (...a: unknown[]) => captureMessageMock(...a) }));
const prismaMock = { newsletterCampaign: { findMany: vi.fn() } };
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { GET } = await import("./route");
const req = (auth?: string) =>
  new Request("https://www.coredxi.com/api/cron/newsletter-collect", { headers: auth ? { authorization: auth } : {} });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "s3cret";
  prismaMock.newsletterCampaign.findMany.mockResolvedValue([{ id: "c1" }, { id: "c2" }]);
  collectCampaignMock.mockResolvedValue({ campaignId: "c1", errors: [], attached: 3 });
});

describe("GET /api/cron/newsletter-collect", () => {
  it("Bearer 불일치·시크릿 미설정이면 401이고 수집하지 않는다", async () => {
    expect((await GET(req("Bearer wrong"))).status).toBe(401);
    delete process.env.CRON_SECRET;
    expect((await GET(req("Bearer undefined"))).status).toBe(401);
    expect(collectCampaignMock).not.toHaveBeenCalled();
  });

  it("활성·비임시저장·기간 내·비즉시 캠페인을 순서대로 수집한다", async () => {
    const res = await GET(req("Bearer s3cret"));
    expect(res.status).toBe(200);
    expect(collectCampaignMock).toHaveBeenCalledTimes(2);
    const where = prismaMock.newsletterCampaign.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ isActive: true, isDraft: false, sendType: { not: "IMMEDIATE" } });
  });

  it("캠페인 하나가 예외를 던져도 나머지를 계속하고 Sentry에 남긴다", async () => {
    collectCampaignMock.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce({ campaignId: "c2", errors: [] });
    const res = await GET(req("Bearer s3cret"));
    const body = await res.json();
    expect(body.results).toHaveLength(2);
    expect(captureMessageMock).toHaveBeenCalled();
  });
});
