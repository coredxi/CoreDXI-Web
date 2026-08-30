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

const prismaMock = {
  axCheckResponse: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const {
  submitAxCheck,
  getAxCheckResultByToken,
  listAxCheckResponses,
  updateAxCheckStatus,
  updateAxCheckNote,
  deleteAxCheckResponse,
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
  prismaMock.axCheckResponse.create.mockResolvedValue({});
  delete process.env.SALES_NOTIFY_EMAIL;
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
  it("saves the response and emails only the sales notify address (no customer auto-send)", async () => {
    const result = await submitAxCheck(validInput());

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("unreachable");
    expect(result.resultToken).toBe("generated-result-token");
    expect(result.priorities).toHaveLength(2);

    expect(prismaMock.axCheckResponse.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          company: "테스트회사",
          email: "user@example.com",
          grade: expect.any(String),
          resultToken: "generated-result-token",
        }),
      })
    );

    // 고객에게는 자동 발송하지 않는다 — sendResendEmail 호출은 영업이사 알림 1건뿐.
    expect(sendResendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendResendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "contact@coredxi.com" })
    );
    expect(sendResendEmailMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ to: "user@example.com" })
    );
    expect(subscribeNewsletterMock).not.toHaveBeenCalled();
  });

  it("includes the customer email draft in the sales notify email body", async () => {
    await submitAxCheck(validInput());

    const salesCall = sendResendEmailMock.mock.calls.find(
      (call) => call[0].to === "contact@coredxi.com"
    );
    expect(salesCall).toBeDefined();
    expect(salesCall![0].text).toContain("고객용 이메일 초안");
    expect(salesCall![0].text).toContain("테스트회사 홍길동님, 안녕하세요.");
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

  it("still succeeds when the sales notify email fails to send", async () => {
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
