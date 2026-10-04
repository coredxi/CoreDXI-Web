import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));
const prismaMock = { newsletterCampaign: { findUnique: vi.fn() } };
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { requireCampaignManager, requireNewsletterAdmin } = await import("./admin-guard");

const session = (role: string | undefined, id = "adm1") => ({
  user: { id, accountType: "admin", role, email: "me@coredxi.com" },
});

beforeEach(() => vi.clearAllMocks());

describe("requireNewsletterAdmin", () => {
  it("SUPER_ADMIN·EDITOR 허용", async () => {
    authMock.mockResolvedValue(session("EDITOR"));
    expect((await requireNewsletterAdmin()).ok).toBe(true);
  });

  it("VIEWER·비로그인·일반회원 거부", async () => {
    for (const s of [session("VIEWER"), null, { user: { accountType: "user" } }]) {
      authMock.mockResolvedValue(s);
      expect((await requireNewsletterAdmin()).ok).toBe(false);
    }
  });
});

describe("requireCampaignManager", () => {
  it("SUPER_ADMIN은 남의 캠페인도 허용", async () => {
    authMock.mockResolvedValue(session("SUPER_ADMIN"));
    prismaMock.newsletterCampaign.findUnique.mockResolvedValue({ ownerId: "other", coManagerIds: [] });
    expect((await requireCampaignManager("c1")).ok).toBe(true);
  });

  it("EDITOR는 owner 또는 coManager일 때만", async () => {
    authMock.mockResolvedValue(session("EDITOR", "adm1"));
    prismaMock.newsletterCampaign.findUnique.mockResolvedValue({ ownerId: "other", coManagerIds: [] });
    expect((await requireCampaignManager("c1")).ok).toBe(false);
    prismaMock.newsletterCampaign.findUnique.mockResolvedValue({ ownerId: "other", coManagerIds: ["adm1"] });
    expect((await requireCampaignManager("c1")).ok).toBe(true);
  });

  it("없는 캠페인은 거부", async () => {
    authMock.mockResolvedValue(session("SUPER_ADMIN"));
    prismaMock.newsletterCampaign.findUnique.mockResolvedValue(null);
    expect(await requireCampaignManager("c1")).toEqual({ ok: false, error: "캠페인을 찾을 수 없습니다." });
  });
});
