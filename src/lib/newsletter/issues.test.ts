import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  newsletterIssue: { findFirst: vi.fn(), aggregate: vi.fn(), create: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { ensureCurrentIssue } = await import("./issues");

const campaign = {
  id: "c1",
  sendType: "REVIEW_THEN_SEND" as const,
  subjectTemplate: "(광고) [AX 위클리 #{{issueNo}}] {{issueDate}}",
  cadence: "WEEKLY" as const,
  sendDayOfWeek: 2,
  sendHourKst: 8,
  activeFrom: new Date("2026-10-01T00:00:00Z"),
  activeUntil: null,
};
const NOW = new Date("2026-10-05T03:00:00Z"); // 월 12:00 KST

beforeEach(() => vi.clearAllMocks());

describe("ensureCurrentIssue", () => {
  it("다음 발송일(화) 호가 없으면 다음 회차로 만든다", async () => {
    prismaMock.newsletterIssue.findFirst.mockResolvedValue(null);
    prismaMock.newsletterIssue.aggregate.mockResolvedValue({ _max: { issueNo: 4 } });
    prismaMock.newsletterIssue.create.mockResolvedValue({ id: "i5", status: "COLLECTING", editedAt: null });

    const issue = await ensureCurrentIssue(campaign, NOW);

    expect(issue?.id).toBe("i5");
    expect(prismaMock.newsletterIssue.create).toHaveBeenCalledWith({
      data: {
        campaignId: "c1",
        issueNo: 5,
        issueDate: new Date("2026-10-05T15:00:00Z"),
        subject: "(광고) [AX 위클리 #5] 2026-10-06",
        status: "COLLECTING",
      },
      select: { id: true, status: true, editedAt: true },
    });
  });

  it("같은 발송일 호가 편집 가능 상태면 그대로 돌려준다", async () => {
    prismaMock.newsletterIssue.findFirst.mockResolvedValue({ id: "i4", status: "DRAFT", editedAt: null });
    expect((await ensureCurrentIssue(campaign, NOW))?.id).toBe("i4");
    expect(prismaMock.newsletterIssue.create).not.toHaveBeenCalled();
  });

  it("같은 발송일 호가 이미 승인/발송됐으면 null(덮어쓰지 않음)", async () => {
    prismaMock.newsletterIssue.findFirst.mockResolvedValue({ id: "i4", status: "APPROVED", editedAt: null });
    expect(await ensureCurrentIssue(campaign, NOW)).toBeNull();
  });

  it("사용기간이 끝난 캠페인은 null", async () => {
    expect(await ensureCurrentIssue({ ...campaign, activeUntil: new Date("2026-10-01T00:00:00Z") }, NOW)).toBeNull();
  });

  it("IMMEDIATE 캠페인은 날짜와 무관하게 취소되지 않은 기존 호 하나만 쓴다", async () => {
    prismaMock.newsletterIssue.findFirst.mockResolvedValue({ id: "i1", status: "SENT", editedAt: null });
    expect(await ensureCurrentIssue({ ...campaign, sendType: "IMMEDIATE" }, NOW)).toBeNull();
    expect(prismaMock.newsletterIssue.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { campaignId: "c1", status: { not: "CANCELED" } } })
    );
  });

  it("회차 경쟁(P2002)이 나면 다시 조회해 기존 호를 돌려준다", async () => {
    prismaMock.newsletterIssue.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "i5", status: "COLLECTING", editedAt: null });
    prismaMock.newsletterIssue.aggregate.mockResolvedValue({ _max: { issueNo: 4 } });
    prismaMock.newsletterIssue.create.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));
    expect((await ensureCurrentIssue(campaign, NOW))?.id).toBe("i5");
  });
});
