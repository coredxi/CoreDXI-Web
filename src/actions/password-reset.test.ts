import { beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@/lib/password-reset-token", () => ({
  generatePasswordResetToken: () => "generated-token",
  getPasswordResetExpiresAt: () => new Date("2026-01-01T01:00:00.000Z"),
}));

const bcryptHashMock = vi.fn();
vi.mock("bcryptjs", () => ({
  default: { hash: (...args: unknown[]) => bcryptHashMock(...args) },
}));

const prismaMock = {
  admin: { findUnique: vi.fn(), update: vi.fn() },
  user: { findUnique: vi.fn(), update: vi.fn() },
  passwordResetToken: {
    findUnique: vi.fn(),
    deleteMany: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { requestPasswordReset, getPasswordResetTokenStatus, resetPasswordWithToken } =
  await import("./password-reset");

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimitMock.mockResolvedValue({ allowed: true });
  sendResendEmailMock.mockResolvedValue({ success: true });
  bcryptHashMock.mockResolvedValue("hashed-password");
  prismaMock.admin.findUnique.mockResolvedValue(null);
  prismaMock.user.findUnique.mockResolvedValue(null);
});

describe("requestPasswordReset validation", () => {
  it("rejects an invalid email", async () => {
    const result = await requestPasswordReset("not-an-email");
    expect(result).toEqual({
      success: false,
      error: "올바른 이메일 주소를 입력해 주세요.",
    });
  });
});

describe("requestPasswordReset rate limiting", () => {
  it("rejects once the IP rate limit is hit", async () => {
    checkRateLimitMock.mockImplementation(async (key: string) =>
      key.startsWith("password-reset-request-ip:")
        ? { allowed: false, retryAfterSeconds: 30 }
        : { allowed: true }
    );

    const result = await requestPasswordReset("user@example.com");

    expect(result).toEqual({
      success: false,
      error: "너무 많은 요청이 접수되었습니다. 30초 후 다시 시도해 주세요.",
    });
  });

  it("rejects once the per-email rate limit is hit", async () => {
    checkRateLimitMock.mockImplementation(async (key: string) =>
      key.startsWith("password-reset-request-email:")
        ? { allowed: false, retryAfterSeconds: 15 }
        : { allowed: true }
    );

    const result = await requestPasswordReset("user@example.com");

    expect(result).toEqual({
      success: false,
      error: "너무 많은 요청이 접수되었습니다. 15초 후 다시 시도해 주세요.",
    });
  });
});

describe("requestPasswordReset — anti account enumeration", () => {
  it("returns a generic success when no account exists, without sending mail", async () => {
    const result = await requestPasswordReset("nobody@example.com");

    expect(result).toEqual({ success: true });
    expect(sendResendEmailMock).not.toHaveBeenCalled();
    expect(prismaMock.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it("issues a token and sends mail when an Admin account exists", async () => {
    prismaMock.admin.findUnique.mockResolvedValue({ id: "admin-1" });

    const result = await requestPasswordReset("Admin@Example.com");

    expect(result).toEqual({ success: true });
    expect(prismaMock.passwordResetToken.deleteMany).toHaveBeenCalledWith({
      where: { email: "admin@example.com" },
    });
    expect(prismaMock.passwordResetToken.create).toHaveBeenCalledWith({
      data: {
        email: "admin@example.com",
        token: "generated-token",
        expiresAt: new Date("2026-01-01T01:00:00.000Z"),
      },
    });
    expect(sendResendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "admin@example.com",
        text: expect.stringContaining("/reset-password/generated-token"),
      })
    );
  });

  it("issues a token when only a User account exists", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "user-1" });

    const result = await requestPasswordReset("user@example.com");

    expect(result).toEqual({ success: true });
    expect(sendResendEmailMock).toHaveBeenCalled();
  });

  it("returns a failure when the email fails to send (unlike contact/newsletter)", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "user-1" });
    sendResendEmailMock.mockResolvedValue({ success: false, error: "boom" });

    const result = await requestPasswordReset("user@example.com");

    expect(result).toEqual({
      success: false,
      error: "메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    });
  });
});

describe("getPasswordResetTokenStatus", () => {
  it("rejects an unknown token", async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue(null);

    const result = await getPasswordResetTokenStatus("bogus");

    expect(result).toEqual({ valid: false, error: "유효하지 않은 링크입니다." });
  });

  it("rejects an expired token", async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() - 1000),
    });

    const result = await getPasswordResetTokenStatus("expired-token");

    expect(result).toEqual({
      valid: false,
      error: "링크가 만료되었습니다. 다시 요청해 주세요.",
    });
  });

  it("accepts a valid, unexpired token", async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 1000 * 60),
    });

    const result = await getPasswordResetTokenStatus("valid-token");

    expect(result).toEqual({ valid: true });
  });
});

describe("resetPasswordWithToken", () => {
  it("rejects a password shorter than 8 characters", async () => {
    const result = await resetPasswordWithToken("token-1", "short");
    expect(result).toEqual({
      success: false,
      error: "비밀번호는 8자 이상이어야 합니다.",
    });
    expect(prismaMock.passwordResetToken.findUnique).not.toHaveBeenCalled();
  });

  it("rejects once the consume rate limit is hit", async () => {
    checkRateLimitMock.mockResolvedValue({ allowed: false, retryAfterSeconds: 10 });

    const result = await resetPasswordWithToken("token-1", "longenoughpw");

    expect(result).toEqual({
      success: false,
      error: "너무 많은 요청이 접수되었습니다. 10초 후 다시 시도해 주세요.",
    });
  });

  it("rejects an unknown token", async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue(null);

    const result = await resetPasswordWithToken("bogus", "longenoughpw");

    expect(result).toEqual({ success: false, error: "유효하지 않은 링크입니다." });
  });

  it("rejects and deletes an expired token", async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue({
      email: "user@example.com",
      expiresAt: new Date(Date.now() - 1000),
    });

    const result = await resetPasswordWithToken("expired-token", "longenoughpw");

    expect(result).toEqual({
      success: false,
      error: "링크가 만료되었습니다. 다시 요청해 주세요.",
    });
    expect(prismaMock.passwordResetToken.delete).toHaveBeenCalledWith({
      where: { token: "expired-token" },
    });
  });

  it("updates the Admin password and consumes the token when the email matches an Admin", async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue({
      email: "admin@example.com",
      expiresAt: new Date(Date.now() + 1000 * 60),
    });
    prismaMock.admin.findUnique.mockResolvedValue({ id: "admin-1" });

    const result = await resetPasswordWithToken("token-1", "longenoughpw");

    expect(result).toEqual({ success: true, accountType: "admin" });
    expect(bcryptHashMock).toHaveBeenCalledWith("longenoughpw", 10);
    expect(prismaMock.admin.update).toHaveBeenCalledWith({
      where: { id: "admin-1" },
      data: { password: "hashed-password" },
    });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
    expect(prismaMock.passwordResetToken.delete).toHaveBeenCalledWith({
      where: { token: "token-1" },
    });
  });

  it("updates the User password when the email matches only a User", async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue({
      email: "user@example.com",
      expiresAt: new Date(Date.now() + 1000 * 60),
    });
    prismaMock.user.findUnique.mockResolvedValue({ id: "user-1" });

    const result = await resetPasswordWithToken("token-1", "longenoughpw");

    expect(result).toEqual({ success: true, accountType: "user" });
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { password: "hashed-password" },
    });
    expect(prismaMock.admin.update).not.toHaveBeenCalled();
  });

  it("fails gracefully when the account was deleted after the token was issued", async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue({
      email: "gone@example.com",
      expiresAt: new Date(Date.now() + 1000 * 60),
    });

    const result = await resetPasswordWithToken("token-1", "longenoughpw");

    expect(result).toEqual({ success: false, error: "유효하지 않은 링크입니다." });
    expect(prismaMock.passwordResetToken.delete).toHaveBeenCalledWith({
      where: { token: "token-1" },
    });
  });
});
