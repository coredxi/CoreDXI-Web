import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const guardMock = { requireNewsletterAdmin: vi.fn(), requireCampaignManager: vi.fn() };
vi.mock("@/lib/newsletter/admin-guard", () => guardMock);
const sendMock = { sendIssue: vi.fn(), sendTestIssue: vi.fn(), renderIssueEmail: vi.fn() };
vi.mock("@/lib/newsletter/send", () => sendMock);

const prismaMock = {
  newsletterIssue: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
  newsletterIssueArticle: { count: vi.fn(), update: vi.fn(), upsert: vi.fn() },
  $transaction: vi.fn(async (arg: unknown) =>
    typeof arg === "function" ? (arg as (tx: unknown) => Promise<unknown>)(prismaMock) : Promise.all(arg as Promise<unknown>[])
  ),
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { approveIssue, attachArticleToIssue, requestIssueReview, sendIssueNow, updateIssue } = await import("./newsletter-issues");

const admin = { adminId: "adm1", role: "EDITOR", email: "me@coredxi.com" };
const issue = {
  id: "i1",
  campaignId: "c1",
  status: "DRAFT",
  campaign: { isDraft: false, cadence: "WEEKLY", sendDayOfWeek: 2, sendHourKst: 8, activeFrom: new Date("2026-10-01T00:00:00Z"), activeUntil: null },
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
    expect(prismaMock.newsletterIssue.updateMany).toHaveBeenCalledWith({
      where: { id: "i1", status: { in: ["COLLECTING", "DRAFT", "REVIEW_REQUESTED"] } },
      data: expect.objectContaining({ subject: "제목", intro: null, editedAt: expect.any(Date) }),
    });
  });

  it("쓰기 시점에 상태가 바뀌었으면(count 0) 기사 행을 건드리지 않고 거부", async () => {
    prismaMock.newsletterIssue.updateMany.mockResolvedValue({ count: 0 });
    const r = await updateIssue("i1", { subject: "s", intro: null, articles: [{ id: "ia1", isSelected: true, sortOrder: 0, editorNote: null, summary: null }] });
    expect(r.success).toBe(false);
    expect(prismaMock.newsletterIssueArticle.update).not.toHaveBeenCalled();
  });
});

describe("attachArticleToIssue", () => {
  it("쓰기 시점에 상태가 바뀌었으면(count 0) upsert 하지 않고 거부", async () => {
    prismaMock.newsletterIssue.updateMany.mockResolvedValue({ count: 0 });
    expect((await attachArticleToIssue("i1", "a1")).success).toBe(false);
    expect(prismaMock.newsletterIssueArticle.upsert).not.toHaveBeenCalled();
  });

  it("조건부 상태 쓰기 후 기사를 추가한다", async () => {
    expect((await attachArticleToIssue("i1", "a1")).success).toBe(true);
    expect(prismaMock.newsletterIssueArticle.upsert).toHaveBeenCalled();
  });
});

describe("임시저장 캠페인", () => {
  it("승인·즉시발송을 거부하고 sendIssue를 호출하지 않는다", async () => {
    prismaMock.newsletterIssue.findUnique.mockResolvedValue({ ...issue, campaign: { ...issue.campaign, isDraft: true } });
    const msg = "임시저장 캠페인은 먼저 저장을 완료해 주세요";
    expect(await approveIssue("i1", null)).toEqual({ success: false, error: msg });
    expect(await sendIssueNow("i1")).toEqual({ success: false, error: msg });
    expect(sendMock.sendIssue).not.toHaveBeenCalled();
    expect(prismaMock.newsletterIssue.updateMany).not.toHaveBeenCalled();
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

  it("직접 고른 예약 시각은 그 시각 이후 첫 08:00 KST 슬롯으로 맞춘다", async () => {
    // 2030-03-05 14:00 KST → 2030-03-06 08:00 KST(= 03-05 23:00 UTC)
    const r = await approveIssue("i1", "2030-03-05T05:00:00.000Z");
    expect(r).toEqual({ success: true, scheduledAt: "2030-03-05T23:00:00.000Z" });
    expect(prismaMock.newsletterIssue.updateMany.mock.calls[0][0].data.scheduledAt.toISOString()).toBe(
      "2030-03-05T23:00:00.000Z"
    );
  });

  it("08시 슬롯으로 맞춘 시각이 캠페인 사용기간을 넘으면 거부", async () => {
    prismaMock.newsletterIssue.findUnique.mockResolvedValue({
      ...issue,
      campaign: { ...issue.campaign, activeUntil: new Date("2030-03-05T14:59:59.999Z") }, // 2030-03-05 KST 끝
    });
    const r = await approveIssue("i1", "2030-03-05T05:00:00.000Z");
    expect(r.success).toBe(false);
    expect(prismaMock.newsletterIssue.updateMany).not.toHaveBeenCalled();
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
