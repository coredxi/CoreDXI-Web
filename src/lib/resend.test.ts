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

  it("headers를 Resend 페이로드에 그대로 전달한다", async () => {
    await sendResendEmail({
      to: "a@example.com",
      subject: "s",
      html: "<p>h</p>",
      headers: { "List-Unsubscribe": "<https://www.coredxi.com/unsubscribe/t>" },
    });
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { "List-Unsubscribe": "<https://www.coredxi.com/unsubscribe/t>" },
      })
    );
  });

  it("성공 시 Resend 메일 id를 돌려준다", async () => {
    sendMock.mockResolvedValueOnce({ data: { id: "re_123" }, error: null });
    await expect(
      sendResendEmail({ to: "a@example.com", subject: "s", text: "t" })
    ).resolves.toEqual({ success: true, id: "re_123" });
  });

  it("idempotencyKey가 주어지면 SDK 두 번째 인자 옵션으로 넘긴다", async () => {
    await sendResendEmail({ to: "a@example.com", subject: "s", text: "t", idempotencyKey: "newsletter:i1:a@example.com" });
    expect(sendMock.mock.calls[0]![1]).toEqual({ idempotencyKey: "newsletter:i1:a@example.com" });
    expect(sendMock.mock.calls[0]![0]).not.toHaveProperty("idempotencyKey");
  });

  it("idempotencyKey가 없으면 옵션 인자 없이 호출한다(기존 호출부 동작 유지)", async () => {
    await sendResendEmail({ to: "a@example.com", subject: "s", text: "t" });
    expect(sendMock.mock.calls[0]).toHaveLength(1);
  });
});
