import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: (...args: unknown[]) => authMock(...args) }));

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
  getResendApiKey: () => null,
}));

const upsertResendAudienceContactMock = vi.fn();
const removeResendAudienceContactMock = vi.fn();
vi.mock("@/lib/resend-audience", () => ({
  upsertResendAudienceContact: (...args: unknown[]) =>
    upsertResendAudienceContactMock(...args),
  removeResendAudienceContact: (...args: unknown[]) =>
    removeResendAudienceContactMock(...args),
}));

vi.mock("@/lib/newsletter-token", () => ({
  generateUnsubscribeToken: () => "generated-token",
}));

const prismaMock = {
  newsletterSubscriber: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn(),
  },
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const {
  subscribeNewsletter,
  unsubscribeNewsletterByToken,
  listNewsletterSubscribers,
} = await import("./newsletter");

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimitMock.mockResolvedValue({ allowed: true });
  upsertResendAudienceContactMock.mockResolvedValue({
    synced: false,
    reason: "RESEND_AUDIENCE_ID 미설정",
  });
  sendResendEmailMock.mockResolvedValue({ success: true });
});

describe("subscribeNewsletter validation", () => {
  it("rejects an invalid email", async () => {
    const result = await subscribeNewsletter("not-an-email");
    expect(result).toEqual({
      success: false,
      error: "올바른 이메일 주소를 입력해 주세요.",
    });
  });
});

describe("subscribeNewsletter rate limiting", () => {
  it("rejects submission once the IP rate limit is hit", async () => {
    checkRateLimitMock.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 30,
    });

    const result = await subscribeNewsletter("user@example.com");

    expect(result).toEqual({
      success: false,
      error: "너무 많은 요청이 접수되었습니다. 30초 후 다시 시도해 주세요.",
    });
  });
});

describe("subscribeNewsletter happy path", () => {
  it("creates a new subscriber and sends a confirmation email", async () => {
    prismaMock.newsletterSubscriber.findUnique.mockResolvedValue(null);
    prismaMock.newsletterSubscriber.upsert.mockResolvedValue({
      email: "user@example.com",
      unsubscribeToken: "generated-token",
      resendContactId: null,
    });

    const result = await subscribeNewsletter("User@Example.com", "footer");

    expect(result).toEqual({ success: true });
    expect(prismaMock.newsletterSubscriber.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: "user@example.com" },
        create: expect.objectContaining({
          email: "user@example.com",
          source: "footer",
        }),
      })
    );
    expect(sendResendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "user@example.com" })
    );
  });

  it("re-subscribes a previously unsubscribed email without a new token", async () => {
    prismaMock.newsletterSubscriber.findUnique.mockResolvedValue({
      unsubscribeToken: "existing-token",
    });
    prismaMock.newsletterSubscriber.upsert.mockResolvedValue({
      email: "user@example.com",
      unsubscribeToken: "existing-token",
      resendContactId: null,
    });

    const result = await subscribeNewsletter("user@example.com");

    expect(result).toEqual({ success: true });
    expect(prismaMock.newsletterSubscriber.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ status: "SUBSCRIBED" }),
      })
    );
  });

  it("still succeeds when the confirmation email fails to send", async () => {
    prismaMock.newsletterSubscriber.findUnique.mockResolvedValue(null);
    prismaMock.newsletterSubscriber.upsert.mockResolvedValue({
      email: "user@example.com",
      unsubscribeToken: "generated-token",
      resendContactId: null,
    });
    sendResendEmailMock.mockResolvedValue({ success: false, error: "boom" });

    const result = await subscribeNewsletter("user@example.com");
    expect(result).toEqual({ success: true });
  });
});

describe("unsubscribeNewsletterByToken", () => {
  it("rejects an unknown token", async () => {
    prismaMock.newsletterSubscriber.findUnique.mockResolvedValue(null);

    const result = await unsubscribeNewsletterByToken("bogus");

    expect(result).toEqual({
      success: false,
      error: "유효하지 않은 구독 해지 링크입니다.",
    });
  });

  it("marks a subscribed record as unsubscribed", async () => {
    prismaMock.newsletterSubscriber.findUnique.mockResolvedValue({
      id: "sub-1",
      email: "user@example.com",
      status: "SUBSCRIBED",
      resendContactId: null,
    });
    prismaMock.newsletterSubscriber.update.mockResolvedValue({});

    const result = await unsubscribeNewsletterByToken("token-1");

    expect(result).toEqual({ success: true, email: "user@example.com" });
    expect(prismaMock.newsletterSubscriber.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sub-1" },
        data: expect.objectContaining({ status: "UNSUBSCRIBED" }),
      })
    );
  });

  it("is idempotent for an already-unsubscribed record", async () => {
    prismaMock.newsletterSubscriber.findUnique.mockResolvedValue({
      id: "sub-1",
      email: "user@example.com",
      status: "UNSUBSCRIBED",
      resendContactId: null,
    });

    const result = await unsubscribeNewsletterByToken("token-1");

    expect(result).toEqual({ success: true, email: "user@example.com" });
    expect(prismaMock.newsletterSubscriber.update).not.toHaveBeenCalled();
  });
});

describe("listNewsletterSubscribers", () => {
  it("requires an admin session", async () => {
    authMock.mockResolvedValue(null);

    const result = await listNewsletterSubscribers();

    expect(result).toEqual({
      success: false,
      error: "관리자 로그인이 필요합니다.",
    });
  });

  it("returns stats and subscribers for an admin session", async () => {
    authMock.mockResolvedValue({
      user: { accountType: "admin", role: "SUPER_ADMIN" },
    });
    prismaMock.newsletterSubscriber.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1);
    prismaMock.newsletterSubscriber.findMany.mockResolvedValue([]);

    const result = await listNewsletterSubscribers();

    expect(result).toEqual({
      success: true,
      stats: { totalSubscribed: 3, totalUnsubscribed: 1 },
      subscribers: [],
    });
  });
});
