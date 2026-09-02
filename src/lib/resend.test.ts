import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: (...args: unknown[]) => sendMock(...args) };
  },
}));

const { sendResendEmail } = await import("./resend");

beforeEach(() => {
  vi.clearAllMocks();
  process.env.RESEND_API_KEY = "test-key";
  sendMock.mockResolvedValue({ error: null });
});

describe("sendResendEmail", () => {
  it("text만 주어지면 text만 보낸다(html 없음)", async () => {
    await sendResendEmail({ to: "a@b.com", subject: "제목", text: "본문" });

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ text: "본문" })
    );
    expect(sendMock.mock.calls[0]![0]).not.toHaveProperty("html");
  });

  it("html만 주어지면 html만 보낸다(text 없음) — 기존 호출부(OTP 메일 등) 호환", async () => {
    await sendResendEmail({ to: "a@b.com", subject: "제목", html: "<b>본문</b>" });

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ html: "<b>본문</b>" })
    );
    expect(sendMock.mock.calls[0]![0]).not.toHaveProperty("text");
  });

  it("text와 html이 함께 주어지면 둘 다 보낸다(멀티파트)", async () => {
    await sendResendEmail({
      to: "a@b.com",
      subject: "제목",
      text: "텍스트 버전",
      html: "<p>HTML 버전</p>",
    });

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ text: "텍스트 버전", html: "<p>HTML 버전</p>" })
    );
  });
});
