import { beforeEach, describe, expect, it, vi } from "vitest";

// ax-check.ts pulls in @/auth (admin-gated actions만) — contact.test.ts와 동일하게
// 모킹해 실제 DATABASE_URL/OAuth 환경 없이 검증 로직을 테스트한다.
const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: (...args: unknown[]) => authMock(...args) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const checkRateLimitMock = vi.fn();
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimitMock(...args),
}));
vi.mock("@/lib/client-ip", () => ({
  getClientIp: vi.fn().mockResolvedValue("127.0.0.1"),
}));

const sendResendEmailMock = vi.fn();
vi.mock("@/lib/resend", () => ({
  sendResendEmail: (...args: unknown[]) => sendResendEmailMock(...args),
}));

const getContactNotificationEmailMock = vi.fn();
vi.mock("@/actions/contact", () => ({
  getContactNotificationEmail: (...args: unknown[]) =>
    getContactNotificationEmailMock(...args),
}));

const subscribeNewsletterMock = vi.fn();
vi.mock("@/actions/newsletter", () => ({
  subscribeNewsletter: (...args: unknown[]) => subscribeNewsletterMock(...args),
}));

vi.mock("@/lib/ax-check/result-token", () => ({
  generateAxCheckResultToken: () => "generated-result-token",
}));

vi.mock("@/lib/ax-check/business-days", () => ({
  computeFollowupScheduledAt: () => new Date("2026-09-04T00:30:00.000Z"),
  formatKstFollowupSchedule: () => "2026-09-04(금) 09:30",
}));

const isFollowupEnabledMock = vi.fn();
const sendFollowupEmailMock = vi.fn();
vi.mock("@/lib/ax-check/followup", () => ({
  isFollowupEnabled: () => isFollowupEnabledMock(),
  sendFollowupEmail: (...args: unknown[]) => sendFollowupEmailMock(...args),
}));

const prismaMock = {
  axCheckResponse: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  },
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

// catalog는 모킹하지 않는다 — 실제 SALES_SIGNATURE 값으로 replyTo 폴백을 검증한다.
const { SALES_SIGNATURE } = await import("@/lib/ax-check/catalog");

const {
  submitAxCheck,
  getAxCheckResultByToken,
  listAxCheckResponses,
  updateAxCheckStatus,
  updateAxCheckNote,
  deleteAxCheckResponse,
  holdAxCheckFollowup,
  resumeAxCheckFollowup,
  sendAxCheckFollowupNow,
  updateAxCheckFollowupDraft,
  resetAxCheckFollowupDraft,
} = await import("./ax-check");

function validAnswers(overrides: Record<string, unknown> = {}) {
  return {
    q1: "network",
    q2: "10_to_30",
    q3: ["quote", "bidding"],
    q4: "personal",
    q5: "files",
    q6: "speed",
    q7: "within_3_months",
    q8: "self_decide",
    ...overrides,
  };
}

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    company: "테스트회사",
    name: "홍길동",
    email: "user@example.com",
    phone: "010-1234-5678",
    refCode: "sales-kim",
    answers: validAnswers(),
    privacyConsent: true,
    marketingOptIn: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimitMock.mockResolvedValue({ allowed: true });
  sendResendEmailMock.mockResolvedValue({ success: true });
  getContactNotificationEmailMock.mockResolvedValue("contact@coredxi.com");
  subscribeNewsletterMock.mockResolvedValue({ success: true });
  prismaMock.axCheckResponse.create.mockResolvedValue({ id: "lead-1" });
  prismaMock.axCheckResponse.update.mockResolvedValue({});
  isFollowupEnabledMock.mockReturnValue(true);
  delete process.env.SALES_NOTIFY_EMAIL;
  delete process.env.SALES_NOTIFY_CC_EMAIL;
  delete process.env.SALES_REPLY_TO;
});

describe("submitAxCheck validation", () => {
  it("rejects a blank company", async () => {
    const result = await submitAxCheck(validInput({ company: "  " }));
    expect(result).toEqual({ success: false, error: "회사명을 입력해 주세요." });
  });

  it("rejects a blank name", async () => {
    const result = await submitAxCheck(validInput({ name: "" }));
    expect(result).toEqual({ success: false, error: "성함을 입력해 주세요." });
  });

  it("rejects an invalid email", async () => {
    const result = await submitAxCheck(validInput({ email: "not-an-email" }));
    expect(result.success).toBe(false);
  });

  it("rejects an invalid phone number", async () => {
    const result = await submitAxCheck(validInput({ phone: "call me" }));
    expect(result).toEqual({
      success: false,
      error: "올바른 휴대전화 번호를 입력해 주세요.",
    });
  });

  it("rejects submission without privacy consent", async () => {
    const result = await submitAxCheck(validInput({ privacyConsent: false }));
    expect(result).toEqual({
      success: false,
      error: "개인정보 수집·이용에 동의해 주세요.",
    });
  });

  it("rejects a missing single-choice answer", async () => {
    const result = await submitAxCheck(
      validInput({ answers: validAnswers({ q1: "" }) })
    );
    expect(result.success).toBe(false);
  });

  it("rejects an out-of-catalog answer value (tampered client)", async () => {
    const result = await submitAxCheck(
      validInput({ answers: validAnswers({ q7: "yesterday" }) })
    );
    expect(result.success).toBe(false);
  });

  it("rejects q3 with zero selections", async () => {
    const result = await submitAxCheck(validInput({ answers: validAnswers({ q3: [] }) }));
    expect(result.success).toBe(false);
  });

  it("rejects q3 with more than the max selections", async () => {
    const result = await submitAxCheck(
      validInput({
        answers: validAnswers({
          q3: ["quote", "bidding", "site_report", "maintenance_request"],
        }),
      })
    );
    expect(result.success).toBe(false);
  });
});

describe("submitAxCheck rate limiting", () => {
  it("rejects submission once the IP rate limit is hit", async () => {
    checkRateLimitMock.mockResolvedValue({ allowed: false, retryAfterSeconds: 20 });

    const result = await submitAxCheck(validInput());

    expect(result).toEqual({
      success: false,
      error: "너무 많은 요청이 접수되었습니다. 20초 후 다시 시도해 주세요.",
    });
    expect(prismaMock.axCheckResponse.create).not.toHaveBeenCalled();
  });
});

describe("submitAxCheck happy path", () => {
  it("응답을 저장하고 followupScheduledAt·followupStatus(SCHEDULED)를 계산해 저장한다", async () => {
    const result = await submitAxCheck(validInput());

    expect(result.success).toBe(true);
    expect(prismaMock.axCheckResponse.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          followupStatus: "SCHEDULED",
          followupScheduledAt: new Date("2026-09-04T00:30:00.000Z"),
        }),
      })
    );
  });

  it("킬 스위치가 꺼져 있으면 followupStatus를 HELD로 저장하고 T0을 보내지 않는다", async () => {
    isFollowupEnabledMock.mockReturnValue(false);

    await submitAxCheck(validInput());

    expect(prismaMock.axCheckResponse.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ followupStatus: "HELD" }),
      })
    );
    // T0 미발송 + 영업이사 알림만 발송 → sendResendEmail 1회
    expect(sendResendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendResendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "contact@coredxi.com" })
    );
  });

  it("영업 알림 메일은 SALES_NOTIFY_EMAIL을 수신, SALES_NOTIFY_CC_EMAIL을 참조로 보낸다", async () => {
    process.env.SALES_NOTIFY_EMAIL = "sales@coredxi.com";
    process.env.SALES_NOTIFY_CC_EMAIL = "tech@coredxi.com";

    await submitAxCheck(validInput());

    expect(sendResendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "sales@coredxi.com", cc: "tech@coredxi.com" })
    );
  });

  it("SALES_NOTIFY_CC_EMAIL 미설정 시 영업 알림 메일에 cc 필드를 넣지 않는다", async () => {
    process.env.SALES_NOTIFY_EMAIL = "sales@coredxi.com";

    await submitAxCheck(validInput());

    const salesCall = sendResendEmailMock.mock.calls.find(
      (call) => (call[0] as { to: string }).to === "sales@coredxi.com"
    );
    expect(salesCall).toBeDefined();
    expect((salesCall![0] as { cc?: string }).cc).toBeUndefined();
  });

  it("고객에게 T0 요약 메일을 즉시 발송한다", async () => {
    await submitAxCheck(validInput());

    expect(sendResendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "user@example.com" })
    );
  });

  it("T0 메일의 replyTo는 SALES_REPLY_TO 미설정 시 영업이사 주소로 떨어진다(noreply 금지)", async () => {
    delete process.env.SALES_REPLY_TO;

    const result = await submitAxCheck(validInput());

    expect(result).toMatchObject({ success: true, t0Sent: true });
    const t0Call = sendResendEmailMock.mock.calls.find(
      (call) => call[0].to === "user@example.com"
    );
    expect(t0Call).toBeDefined();
    expect(t0Call![0].replyTo).toBe(SALES_SIGNATURE.email);
    expect(t0Call![0].replyTo).toEqual(expect.any(String));
    expect(t0Call![0].replyTo).not.toMatch(/noreply/i);
  });

  it("SALES_REPLY_TO가 설정돼 있으면 T0 replyTo로 그 값을 쓴다", async () => {
    process.env.SALES_REPLY_TO = "sales-reply@coredxi.com";

    await submitAxCheck(validInput());

    const t0Call = sendResendEmailMock.mock.calls.find(
      (call) => call[0].to === "user@example.com"
    );
    expect(t0Call![0].replyTo).toBe("sales-reply@coredxi.com");
  });

  it("T0 발송에 성공하면 t0Sent=true를 반환한다", async () => {
    const result = await submitAxCheck(validInput());

    expect(result).toMatchObject({ success: true, resultToken: "generated-result-token", t0Sent: true });
  });

  it("킬 스위치가 꺼져 있으면 t0Sent=false를 반환한다", async () => {
    isFollowupEnabledMock.mockReturnValue(false);

    const result = await submitAxCheck(validInput());

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("unreachable");
    expect(result.t0Sent).toBe(false);
  });

  it("T0 발송이 실패하면 t0Sent=false를 반환한다", async () => {
    sendResendEmailMock.mockResolvedValue({ success: false, error: "boom" });

    const result = await submitAxCheck(validInput());

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("unreachable");
    expect(result.t0Sent).toBe(false);
  });

  it("t0SentAt 기록 update가 실패해도 제출은 성공으로 끝난다", async () => {
    prismaMock.axCheckResponse.update.mockRejectedValue(new Error("db blip"));

    const result = await submitAxCheck(validInput());

    expect(result).toMatchObject({ success: true, t0Sent: true });
  });

  it("영업이사 알림 메일에는 통화 포인트·예정 시각·관리 링크가 있고 초안 전문은 없다", async () => {
    await submitAxCheck(validInput());

    const salesCall = sendResendEmailMock.mock.calls.find(
      (call) => call[0].to === "contact@coredxi.com"
    );
    expect(salesCall).toBeDefined();
    const text = salesCall![0].text as string;
    expect(text).toContain("통화 포인트");
    expect(text).toContain("상세 진단 메일 예정: 2026-09-04(금) 09:30");
    expect(text).toContain("/admin/leads?lead=lead-1");
    expect(text).not.toContain("고객용 이메일 초안");
  });

  it("HOT 등급이면 알림 메일 제목에 [HOT]이 붙는다", async () => {
    await submitAxCheck(
      validInput({
        answers: validAnswers({ q7: "within_3_months", q8: "self_decide", q3: ["quote", "bidding"] }),
      })
    );

    const salesCall = sendResendEmailMock.mock.calls.find(
      (call) => call[0].to === "contact@coredxi.com"
    );
    expect(salesCall![0].subject).toContain("[HOT]");
  });

  it("uses SALES_NOTIFY_EMAIL over the contact settings fallback when set", async () => {
    process.env.SALES_NOTIFY_EMAIL = "sales@coredxi.com";

    await submitAxCheck(validInput());

    expect(sendResendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "sales@coredxi.com" })
    );
    expect(getContactNotificationEmailMock).not.toHaveBeenCalled();
  });

  it("subscribes to the newsletter when marketingOptIn is true", async () => {
    await submitAxCheck(validInput({ marketingOptIn: true }));

    expect(subscribeNewsletterMock).toHaveBeenCalledWith("user@example.com", "ax-check");
  });

  it("T0 발송이 실패해도 제출 자체는 성공한다", async () => {
    sendResendEmailMock.mockResolvedValue({ success: false, error: "boom" });

    const result = await submitAxCheck(validInput());

    expect(result.success).toBe(true);
  });

  it("surfaces an error when the DB write fails", async () => {
    prismaMock.axCheckResponse.create.mockRejectedValue(new Error("db down"));

    const result = await submitAxCheck(validInput());

    expect(result).toEqual({
      success: false,
      error: "제출 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    });
    expect(sendResendEmailMock).not.toHaveBeenCalled();
  });
});

describe("getAxCheckResultByToken", () => {
  it("rejects an unknown token", async () => {
    prismaMock.axCheckResponse.findUnique.mockResolvedValue(null);

    const result = await getAxCheckResultByToken("bogus");

    expect(result).toEqual({ success: false, error: "유효하지 않은 결과 링크입니다." });
  });

  it("returns company and priorities only (no email/grade leaked)", async () => {
    const priority = {
      title: "제안서 자동화",
      why: "이유",
      echo: "echo",
      industryExample: null,
      roadmap: ["1주차", "1개월차", "3개월차"],
      expectedEffect: "효과",
    };
    prismaMock.axCheckResponse.findUnique.mockResolvedValue({
      company: "테스트회사",
      summary: { priorities: [priority] },
    });

    const result = await getAxCheckResultByToken("token-1");

    expect(result).toEqual({
      success: true,
      data: { company: "테스트회사", priorities: [priority] },
    });
  });

  it("normalizes a legacy (pre-roadmap) priority shape instead of crashing", async () => {
    prismaMock.axCheckResponse.findUnique.mockResolvedValue({
      company: "테스트회사",
      summary: {
        priorities: [
          { title: "제안서 자동화", why: "이유", firstStep: "구버전 첫 단계", expectedEffect: "효과" },
        ],
      },
    });

    const result = await getAxCheckResultByToken("token-legacy");

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("unreachable");
    expect(result.data.priorities[0]).toMatchObject({
      title: "제안서 자동화",
      echo: "",
      industryExample: null,
      roadmap: ["구버전 첫 단계", "—", "—"],
    });
  });
});

describe("admin-gated actions", () => {
  it("listAxCheckResponses requires an admin session", async () => {
    authMock.mockResolvedValue(null);

    const result = await listAxCheckResponses();

    expect(result).toEqual({ success: false, error: "관리자 로그인이 필요합니다." });
  });

  it("listAxCheckResponses sorts HOT before WARM before COLD", async () => {
    authMock.mockResolvedValue({ user: { accountType: "admin", role: "EDITOR" } });
    const now = new Date();
    prismaMock.axCheckResponse.findMany.mockResolvedValue([
      { id: "1", grade: "COLD", createdAt: now, summary: { priorities: [] }, answers: {} },
      { id: "2", grade: "HOT", createdAt: now, summary: { priorities: [] }, answers: {} },
      { id: "3", grade: "WARM", createdAt: now, summary: { priorities: [] }, answers: {} },
    ]);

    const result = await listAxCheckResponses();

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("unreachable");
    expect(result.leads.map((l) => l.grade)).toEqual(["HOT", "WARM", "COLD"]);
  });

  it("updateAxCheckStatus requires an admin session", async () => {
    authMock.mockResolvedValue(null);

    const result = await updateAxCheckStatus("id-1", "CONTACTED");

    expect(result).toEqual({ success: false, error: "관리자 로그인이 필요합니다." });
  });

  it("updateAxCheckStatus rejects an invalid status value", async () => {
    authMock.mockResolvedValue({ user: { accountType: "admin", role: "EDITOR" } });

    // @ts-expect-error intentionally invalid for the test
    const result = await updateAxCheckStatus("id-1", "BOGUS");

    expect(result).toEqual({ success: false, error: "유효하지 않은 요청입니다." });
    expect(prismaMock.axCheckResponse.update).not.toHaveBeenCalled();
  });

  it("updateAxCheckStatus updates the record for a valid admin request", async () => {
    authMock.mockResolvedValue({ user: { accountType: "admin", role: "EDITOR" } });
    prismaMock.axCheckResponse.update.mockResolvedValue({});

    const result = await updateAxCheckStatus("id-1", "CONTACTED");

    expect(result).toEqual({ success: true });
    expect(prismaMock.axCheckResponse.update).toHaveBeenCalledWith({
      where: { id: "id-1" },
      data: { status: "CONTACTED" },
    });
  });

  it("updateAxCheckNote requires an admin session", async () => {
    authMock.mockResolvedValue(null);

    const result = await updateAxCheckNote("id-1", "메모");

    expect(result).toEqual({ success: false, error: "관리자 로그인이 필요합니다." });
  });

  it("deleteAxCheckResponse requires an admin session", async () => {
    authMock.mockResolvedValue(null);

    const result = await deleteAxCheckResponse("id-1");

    expect(result).toEqual({ success: false, error: "관리자 로그인이 필요합니다." });
  });

  it("deleteAxCheckResponse deletes the record for a valid admin request", async () => {
    authMock.mockResolvedValue({ user: { accountType: "admin", role: "SUPER_ADMIN" } });
    prismaMock.axCheckResponse.delete.mockResolvedValue({});

    const result = await deleteAxCheckResponse("id-1");

    expect(result).toEqual({ success: true });
    expect(prismaMock.axCheckResponse.delete).toHaveBeenCalledWith({ where: { id: "id-1" } });
  });
});

describe("admin followup actions", () => {
  beforeEach(() => {
    prismaMock.axCheckResponse.updateMany = vi.fn();
    prismaMock.axCheckResponse.findUnique = vi.fn();
  });

  it("holdAxCheckFollowup은 관리자 로그인을 요구한다", async () => {
    authMock.mockResolvedValue(null);

    const result = await holdAxCheckFollowup("id-1");

    expect(result).toEqual({ success: false, error: "관리자 로그인이 필요합니다." });
  });

  it("holdAxCheckFollowup은 SCHEDULED/FAILED 상태에서만 HELD로 전이한다", async () => {
    authMock.mockResolvedValue({ user: { accountType: "admin", role: "EDITOR" } });
    prismaMock.axCheckResponse.updateMany.mockResolvedValue({ count: 1 });

    const result = await holdAxCheckFollowup("id-1");

    expect(result).toEqual({ success: true });
    expect(prismaMock.axCheckResponse.updateMany).toHaveBeenCalledWith({
      where: { id: "id-1", followupStatus: { in: ["SCHEDULED", "FAILED"] } },
      data: { followupStatus: "HELD" },
    });
  });

  it("holdAxCheckFollowup은 대상 상태가 아니면 에러를 반환한다", async () => {
    authMock.mockResolvedValue({ user: { accountType: "admin", role: "EDITOR" } });
    prismaMock.axCheckResponse.updateMany.mockResolvedValue({ count: 0 });

    const result = await holdAxCheckFollowup("id-1");

    expect(result).toEqual({ success: false, error: "보류할 수 있는 상태가 아닙니다." });
  });

  it("resumeAxCheckFollowup은 HELD가 아니면 에러를 반환한다", async () => {
    authMock.mockResolvedValue({ user: { accountType: "admin", role: "EDITOR" } });
    prismaMock.axCheckResponse.findUnique.mockResolvedValue({
      followupStatus: "SCHEDULED",
      followupScheduledAt: new Date(),
    });

    const result = await resumeAxCheckFollowup("id-1");

    expect(result).toEqual({ success: false, error: "보류 상태가 아닙니다." });
  });

  it("resumeAxCheckFollowup은 HELD를 SCHEDULED로 되돌린다", async () => {
    authMock.mockResolvedValue({ user: { accountType: "admin", role: "EDITOR" } });
    prismaMock.axCheckResponse.findUnique.mockResolvedValue({
      followupStatus: "HELD",
      followupScheduledAt: new Date("2099-01-01T00:00:00Z"),
    });
    prismaMock.axCheckResponse.update.mockResolvedValue({});

    const result = await resumeAxCheckFollowup("id-1");

    expect(result).toEqual({ success: true });
    expect(prismaMock.axCheckResponse.update).toHaveBeenCalledWith({
      where: { id: "id-1" },
      data: { followupStatus: "SCHEDULED", followupScheduledAt: new Date("2099-01-01T00:00:00Z") },
    });
  });

  it("resumeAxCheckFollowup은 예정 시각이 이미 지났으면 지금으로 당긴다", async () => {
    authMock.mockResolvedValue({ user: { accountType: "admin", role: "EDITOR" } });
    prismaMock.axCheckResponse.findUnique.mockResolvedValue({
      followupStatus: "HELD",
      followupScheduledAt: new Date("2020-01-01T00:00:00Z"),
    });
    prismaMock.axCheckResponse.update.mockResolvedValue({});

    await resumeAxCheckFollowup("id-1");

    const call = prismaMock.axCheckResponse.update.mock.calls[0]![0];
    expect(call.data.followupScheduledAt.getTime()).toBeGreaterThan(
      new Date("2020-01-01T00:00:00Z").getTime()
    );
  });

  it("sendAxCheckFollowupNow는 관리자 로그인을 요구한다", async () => {
    authMock.mockResolvedValue(null);

    const result = await sendAxCheckFollowupNow("id-1");

    expect(result).toEqual({ success: false, error: "관리자 로그인이 필요합니다." });
    expect(sendFollowupEmailMock).not.toHaveBeenCalled();
  });

  it("sendAxCheckFollowupNow는 force:true로 sendFollowupEmail을 호출한다", async () => {
    authMock.mockResolvedValue({ user: { accountType: "admin", role: "EDITOR" } });
    sendFollowupEmailMock.mockResolvedValue({ success: true });

    const result = await sendAxCheckFollowupNow("id-1");

    expect(result).toEqual({ success: true });
    expect(sendFollowupEmailMock).toHaveBeenCalledWith("id-1", { force: true });
  });

  it("updateAxCheckFollowupDraft는 빈 제목/본문을 거부한다", async () => {
    authMock.mockResolvedValue({ user: { accountType: "admin", role: "EDITOR" } });

    const result = await updateAxCheckFollowupDraft("id-1", "  ", "본문");

    expect(result).toEqual({ success: false, error: "제목과 본문을 모두 입력해 주세요." });
  });

  it("updateAxCheckFollowupDraft는 override를 저장한다", async () => {
    authMock.mockResolvedValue({ user: { accountType: "admin", role: "EDITOR" } });
    prismaMock.axCheckResponse.update.mockResolvedValue({});

    const result = await updateAxCheckFollowupDraft("id-1", "새 제목", "새 본문");

    expect(result).toEqual({ success: true });
    expect(prismaMock.axCheckResponse.update).toHaveBeenCalledWith({
      where: { id: "id-1" },
      data: { followupSubject: "새 제목", followupBody: "새 본문" },
    });
  });

  it("resetAxCheckFollowupDraft는 override를 null로 되돌린다", async () => {
    authMock.mockResolvedValue({ user: { accountType: "admin", role: "EDITOR" } });
    prismaMock.axCheckResponse.update.mockResolvedValue({});

    const result = await resetAxCheckFollowupDraft("id-1");

    expect(result).toEqual({ success: true });
    expect(prismaMock.axCheckResponse.update).toHaveBeenCalledWith({
      where: { id: "id-1" },
      data: { followupSubject: null, followupBody: null },
    });
  });
});
