import { beforeEach, describe, expect, it, vi } from "vitest";

const sendResendEmailMock = vi.fn();
vi.mock("@/lib/resend", () => ({ sendResendEmail: (...a: unknown[]) => sendResendEmailMock(...a) }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

const prismaMock = {
  newsletterIssue: { updateMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  newsletterSubscriber: { findMany: vi.fn(), updateMany: vi.fn() },
  newsletterDelivery: { createMany: vi.fn(), findMany: vi.fn(), update: vi.fn(), count: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

// 프리뷰 배포처럼 NEXTAUTH_URL이 운영 도메인이 아니어도, 메일 링크는 운영 도메인으로 고정돼야 한다.
process.env.NEXTAUTH_URL = "https://preview-abc.vercel.app/";

const { ISSUE_SEND_LOCK_ERROR, processDueIssues, sendIssue, sendTestIssue } = await import("./send");

const issueRow = {
  id: "i1",
  issueNo: 1,
  issueDate: new Date("2026-10-05T15:00:00Z"),
  subject: "[AX 위클리] 수정된 제목", // 관리자가 (광고)를 지운 상황
  intro: null,
  campaign: { audience: "subscribers", internalRecipients: [] },
  articles: [
    {
      summary: null,
      editorNote: null,
      article: {
        title: "기사",
        originalUrl: "https://www.etnews.com/1",
        snippet: "s",
        publishedAt: new Date("2026-10-05T00:00:00Z"),
        sourceName: null,
        source: { name: "전자신문" },
      },
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.NEWSLETTER_MAX_RECIPIENTS;
  prismaMock.newsletterIssue.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.newsletterIssue.findUnique.mockResolvedValue(issueRow);
  prismaMock.newsletterSubscriber.findMany.mockResolvedValue([
    { id: "u1", email: "a@example.com", unsubscribeToken: "tokA" },
    { id: "u2", email: "b@example.com", unsubscribeToken: "tokB" },
  ]);
  prismaMock.newsletterDelivery.findMany.mockResolvedValue([
    { id: "d1", email: "a@example.com", subscriberId: "u1" },
    { id: "d2", email: "b@example.com", subscriberId: "u2" },
  ]);
  dailySent = 0;
  // where.sentAt이 있으면 "최근 24시간 전체 발송 수"(일 한도 검사), 없으면 이 호의 SENT 수.
  prismaMock.newsletterDelivery.count.mockImplementation(async (args: { where: { sentAt?: unknown } }) =>
    args.where.sentAt ? dailySent : 2
  );
  sendResendEmailMock.mockResolvedValue({ success: true, id: "re_1" });
});

let dailySent = 0;

describe("sendIssue", () => {
  it("선점 실패 시 발송하지 않는다", async () => {
    prismaMock.newsletterIssue.updateMany.mockResolvedValue({ count: 0 });
    await expect(sendIssue("i1", { throttleMs: 0 })).resolves.toEqual({ success: false, error: ISSUE_SEND_LOCK_ERROR });
    expect(sendResendEmailMock).not.toHaveBeenCalled();
  });

  it("구독자별 수신거부 링크·List-Unsubscribe 헤더·(광고) 제목으로 보내고 SENT로 마감", async () => {
    const result = await sendIssue("i1", { throttleMs: 0 });
    expect(result).toEqual({ success: true, sent: 2, failed: 0, skipped: 0 });

    const first = sendResendEmailMock.mock.calls[0][0];
    expect(first.to).toBe("a@example.com");
    expect(first.subject).toBe("(광고) [AX 위클리] 수정된 제목");
    expect(first.html).toContain("https://www.coredxi.com/unsubscribe/tokA");
    expect(first.html).not.toContain("{{UNSUBSCRIBE_URL}}");
    expect(first.headers).toEqual({ "List-Unsubscribe": "<https://www.coredxi.com/unsubscribe/tokA>" });
    expect(first.html).not.toContain("preview-abc");
    expect(first.html).toContain("https://www.coredxi.com/ax-check?ref=newsletter");
    expect(first.html).toContain("https://www.coredxi.com/brand/email-logo.png");
    expect(first.idempotencyKey).toBe("newsletter:i1:a@example.com");
    expect(sendResendEmailMock.mock.calls[1][0].idempotencyKey).toBe("newsletter:i1:b@example.com");

    expect(prismaMock.newsletterDelivery.createMany).toHaveBeenCalledWith({
      data: [
        { issueId: "i1", subscriberId: "u1", email: "a@example.com" },
        { issueId: "i1", subscriberId: "u2", email: "b@example.com" },
      ],
      skipDuplicates: true,
    });
    expect(prismaMock.newsletterIssue.update).toHaveBeenLastCalledWith({
      where: { id: "i1" },
      data: expect.objectContaining({ status: "SENT", recipientCount: 2, lastError: null }),
    });
  });

  it("QUEUED 이후 구독 해지한 사람은 SKIPPED", async () => {
    prismaMock.newsletterSubscriber.findMany.mockResolvedValue([
      { id: "u1", email: "a@example.com", unsubscribeToken: "tokA" },
    ]);
    const result = await sendIssue("i1", { throttleMs: 0 });
    expect(result).toEqual({ success: true, sent: 1, failed: 0, skipped: 1 });
    expect(prismaMock.newsletterDelivery.update).toHaveBeenCalledWith({
      where: { id: "d2" },
      data: { status: "SKIPPED" },
    });
  });

  it("일부 실패하면 FAILED + lastError, 재시도 시 QUEUED/FAILED만 다시 조회", async () => {
    sendResendEmailMock.mockResolvedValueOnce({ success: true, id: "re_1" }).mockResolvedValueOnce({ success: false, error: "rate" });
    const result = await sendIssue("i1", { throttleMs: 0 });
    expect(result).toEqual({ success: true, sent: 1, failed: 1, skipped: 0 });
    expect(prismaMock.newsletterDelivery.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { issueId: "i1", status: { in: ["QUEUED", "FAILED"] } } })
    );
    expect(prismaMock.newsletterIssue.update).toHaveBeenLastCalledWith({
      where: { id: "i1" },
      data: expect.objectContaining({ status: "FAILED", lastError: "1건 발송 실패" }),
    });
  });

  it("선별 기사가 0건이면 보내지 않고 DRAFT로 되돌린다", async () => {
    prismaMock.newsletterIssue.findUnique.mockResolvedValue({ ...issueRow, articles: [] });
    const result = await sendIssue("i1", { throttleMs: 0 });
    expect(result).toEqual({ success: false, error: "선별된 기사가 없습니다." });
    expect(prismaMock.newsletterIssue.update).toHaveBeenCalledWith({
      where: { id: "i1" },
      data: { status: "DRAFT", lastError: "선별된 기사가 없습니다." },
    });
  });

  it("수신자가 상한을 넘으면 보내지 않고 FAILED", async () => {
    process.env.NEWSLETTER_MAX_RECIPIENTS = "1";
    const result = await sendIssue("i1", { throttleMs: 0 });
    expect(result.success).toBe(false);
    expect(sendResendEmailMock).not.toHaveBeenCalled();
  });

  it("internal 캠페인은 내부 수신자에게 mailto 수신중단 링크로 보낸다", async () => {
    prismaMock.newsletterIssue.findUnique.mockResolvedValue({
      ...issueRow,
      campaign: { audience: "internal", internalRecipients: ["ceo@coredxi.com"] },
    });
    prismaMock.newsletterDelivery.findMany.mockResolvedValue([{ id: "d1", email: "ceo@coredxi.com", subscriberId: null }]);
    await sendIssue("i1", { throttleMs: 0 });
    expect(prismaMock.newsletterSubscriber.findMany).not.toHaveBeenCalled();
    expect(sendResendEmailMock.mock.calls[0][0].html).toContain("mailto:");
  });

  it("최근 24시간 발송 수 + 이번 수신자 수가 일 한도를 넘으면 보내지 않고 FAILED", async () => {
    dailySent = 79; // 79 + 2명 > 80
    const result = await sendIssue("i1", { throttleMs: 0 });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("24시간");
    expect(sendResendEmailMock).not.toHaveBeenCalled();
    expect(prismaMock.newsletterDelivery.createMany).not.toHaveBeenCalled();
    expect(prismaMock.newsletterDelivery.count).toHaveBeenCalledWith({
      where: { status: "SENT", sentAt: { gte: expect.any(Date) }, issueId: { not: "i1" } },
    });
    expect(prismaMock.newsletterIssue.update).toHaveBeenLastCalledWith({
      where: { id: "i1" },
      data: { status: "FAILED", lastError: expect.stringContaining("24시간") },
    });
  });

  it("일 한도 경계(78 + 2 = 80)는 발송한다", async () => {
    dailySent = 78;
    const result = await sendIssue("i1", { throttleMs: 0 });
    expect(result).toEqual({ success: true, sent: 2, failed: 0, skipped: 0 });
  });

  it("수신자가 0명이면 SENT로 끝내지 않고 FAILED + lastError", async () => {
    prismaMock.newsletterSubscriber.findMany.mockResolvedValue([]);
    const result = await sendIssue("i1", { throttleMs: 0 });
    expect(result).toEqual({ success: false, error: expect.stringContaining("수신자가 없습니다") });
    expect(sendResendEmailMock).not.toHaveBeenCalled();
    expect(prismaMock.newsletterDelivery.createMany).not.toHaveBeenCalled();
    expect(prismaMock.newsletterIssue.update).toHaveBeenLastCalledWith({
      where: { id: "i1" },
      data: { status: "FAILED", lastError: expect.stringContaining("수신자가 없습니다") },
    });
  });
});

describe("processDueIssues", () => {
  it("멈춘 SENDING은 FAILED로 회수하고, 예약 시각이 지난 APPROVED만 발송", async () => {
    const now = new Date("2026-10-05T23:05:00Z");
    prismaMock.newsletterIssue.findMany
      .mockResolvedValueOnce([{ id: "stale" }])
      .mockResolvedValueOnce([{ id: "i1" }]);
    const result = await processDueIssues({ now, throttleMs: 0 });
    expect(prismaMock.newsletterIssue.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["stale"] }, status: "SENDING" },
      data: { status: "FAILED", lastError: expect.stringContaining("중단") },
    });
    expect(result).toEqual({ processed: 1, sent: 1, failed: 0, recovered: 1 });
  });

  it("사용 중(isActive)이고 사용기간이 남은 캠페인의 호만 발송 대상으로 고른다", async () => {
    const now = new Date("2026-10-05T23:05:00Z");
    prismaMock.newsletterIssue.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    await processDueIssues({ now, throttleMs: 0 });
    expect(prismaMock.newsletterIssue.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          status: "APPROVED",
          scheduledAt: { lte: now },
          campaign: { isActive: true, OR: [{ activeUntil: null }, { activeUntil: { gte: now } }] },
        },
      })
    );
  });
});

describe("sendTestIssue", () => {
  it("[테스트] 표기 + (광고) 맨 앞, 수신거부는 사이트 주소로, 발송 기록 없음", async () => {
    await sendTestIssue("i1", ["me@coredxi.com"]);
    const call = sendResendEmailMock.mock.calls[0][0];
    expect(call.subject).toBe("(광고) [테스트] [AX 위클리] 수정된 제목");
    expect(call.html).not.toContain("{{UNSUBSCRIBE_URL}}");
    expect(call.html).toContain('href="https://www.coredxi.com/#newsletter"');
    expect(call.html).not.toContain("preview-abc");
    expect(prismaMock.newsletterDelivery.createMany).not.toHaveBeenCalled();
  });
});
