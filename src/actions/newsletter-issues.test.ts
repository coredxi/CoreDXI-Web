import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const guardMock = { requireNewsletterAdmin: vi.fn(), requireCampaignManager: vi.fn() };
vi.mock("@/lib/newsletter/admin-guard", () => guardMock);
const sendMock = { sendIssue: vi.fn(), sendTestIssue: vi.fn(), renderIssueEmail: vi.fn() };
vi.mock("@/lib/newsletter/send", () => sendMock);

const prismaMock = {
  newsletterIssue: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
  newsletterIssueArticle: { count: vi.fn(), update: vi.fn(), upsert: vi.fn() },
  $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { approveIssue, requestIssueReview, sendIssueNow, updateIssue } = await import("./newsletter-issues");

const admin = { adminId: "adm1", role: "EDITOR", email: "me@coredxi.com" };
const issue = {
  id: "i1",
  campaignId: "c1",
  status: "DRAFT",
  campaign: { cadence: "WEEKLY", sendDayOfWeek: 2, sendHourKst: 8, activeFrom: new Date("2026-10-01T00:00:00Z"), activeUntil: null },
};

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.NEWSLETTER_TEST_RECIPIENTS;
  guardMock.requireCampaignManager.mockResolvedValue({ ok: true, admin });
  prismaMock.newsletterIssue.findUnique.mockResolvedValue(issue);
  prismaMock.newsletterIssue.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.newsletterIssueArticle.count.mockResolvedValue(3);
});

describe("updateIssue", () => {
  it("편집 불가 상태(APPROVED 등)면 거부", async () => {
    prismaMock.newsletterIssue.findUnique.mockResolvedValue({ ...issue, status: "APPROVED" });
    expect((await updateIssue("i1", { subject: "s", intro: null, articles: [] })).success).toBe(false);
  });

  it("기사 선택·순서·코멘트를 저장하고 editedAt을 찍는다", async () => {
    await updateIssue("i1", {
      subject: " 제목 ",
      intro: "",
      articles: [{ id: "ia1", isSelected: true, sortOrder: 0, editorNote: " 메모 ", summary: "" }],
    });
    expect(prismaMock.newsletterIssueArticle.update).toHaveBeenCalledWith({
      where: { id: "ia1", issueId: "i1" },
      data: { isSelected: true, sortOrder: 0, editorNote: "메모", summary: null },
    });
    expect(prismaMock.newsletterIssue.update).toHaveBeenCalledWith({
      where: { id: "i1" },
      data: expect.objectContaining({ subject: "제목", intro: null, editedAt: expect.any(Date) }),
    });
  });
});

describe("approveIssue", () => {
  it("선택된 기사가 없으면 거부", async () => {
    prismaMock.newsletterIssueArticle.count.mockResolvedValue(0);
    expect((await approveIssue("i1", null)).success).toBe(false);
  });

  it("예약 시각 미지정이면 캠페인 다음 슬롯으로 APPROVED", async () => {
    const r = await approveIssue("i1", null);
    expect(r.success).toBe(true);
    const call = prismaMock.newsletterIssue.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ id: "i1", status: { in: ["COLLECTING", "DRAFT", "REVIEW_REQUESTED"] } });
    expect(call.data).toMatchObject({ status: "APPROVED", approvedById: "adm1" });
    expect(call.data.scheduledAt.getUTCHours()).toBe(23); // 08:00 KST
  });

  it("과거 예약 시각은 거부", async () => {
    expect((await approveIssue("i1", "2020-01-01T00:00:00.000Z")).success).toBe(false);
  });
});

describe("requestIssueReview", () => {
  it("로그인 관리자 + NEWSLETTER_TEST_RECIPIENTS에게 테스트 발송 후 REVIEW_REQUESTED", async () => {
    process.env.NEWSLETTER_TEST_RECIPIENTS = "sales@coredxi.com, me@coredxi.com";
    sendMock.sendTestIssue.mockResolvedValue({ success: true });
    const r = await requestIssueReview("i1");
    expect(sendMock.sendTestIssue).toHaveBeenCalledWith("i1", ["me@coredxi.com", "sales@coredxi.com"]);
    expect(r).toEqual({ success: true, recipients: ["me@coredxi.com", "sales@coredxi.com"] });
    expect(prismaMock.newsletterIssue.updateMany).toHaveBeenCalledWith({
      where: { id: "i1", status: { in: ["COLLECTING", "DRAFT"] } },
      data: { status: "REVIEW_REQUESTED" },
    });
  });

  it("테스트 발송 실패면 상태를 바꾸지 않는다", async () => {
    sendMock.sendTestIssue.mockResolvedValue({ success: false, error: "설정 안 됨" });
    expect(await requestIssueReview("i1")).toEqual({ success: false, error: "설정 안 됨" });
    expect(prismaMock.newsletterIssue.updateMany).not.toHaveBeenCalled();
  });
});

describe("sendIssueNow", () => {
  it("DRAFT·REVIEW_REQUESTED·APPROVED·FAILED에서 즉시 발송을 허용한다", async () => {
    sendMock.sendIssue.mockResolvedValue({ success: true, sent: 2, failed: 0, skipped: 0 });
    const r = await sendIssueNow("i1");
    expect(sendMock.sendIssue).toHaveBeenCalledWith("i1", { allowFrom: ["DRAFT", "REVIEW_REQUESTED", "APPROVED", "FAILED"] });
    expect(r).toEqual({ success: true, sent: 2, failed: 0, skipped: 0 });
  });

  it("담당자가 아니면 발송하지 않는다", async () => {
    guardMock.requireCampaignManager.mockResolvedValue({ ok: false, error: "담당자만" });
    expect(await sendIssueNow("i1")).toEqual({ success: false, error: "담당자만" });
    expect(sendMock.sendIssue).not.toHaveBeenCalled();
  });
});
