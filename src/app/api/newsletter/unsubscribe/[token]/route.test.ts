import { beforeEach, describe, expect, it, vi } from "vitest";

const unsubscribeMock = vi.fn();
vi.mock("@/actions/newsletter", () => ({
  unsubscribeNewsletterByToken: (...a: unknown[]) => unsubscribeMock(...a),
}));
const checkRateLimitMock = vi.fn();
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...a: unknown[]) => checkRateLimitMock(...a),
}));
vi.mock("@/lib/client-ip", () => ({ getClientIp: vi.fn().mockResolvedValue("1.2.3.4") }));

const { GET, POST } = await import("./route");

const URL_BASE = "https://www.coredxi.com/api/newsletter/unsubscribe/tokA";
const ctx = { params: Promise.resolve({ token: "tokA" }) };

function oneClickPost(body = "List-Unsubscribe=One-Click") {
  return new Request(URL_BASE, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimitMock.mockResolvedValue({ allowed: true });
  unsubscribeMock.mockResolvedValue({ success: true, email: "a@example.com" });
});

describe("원클릭 수신거부 API (RFC 8058)", () => {
  it("GET은 해지하지 않고 확인 화면으로 303 리다이렉트한다(보안 검사기 안전)", async () => {
    const res = await GET(new Request(URL_BASE), ctx);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://www.coredxi.com/unsubscribe/tokA");
    expect(unsubscribeMock).not.toHaveBeenCalled();
  });

  it("List-Unsubscribe=One-Click POST는 해지하고 200", async () => {
    const res = await POST(oneClickPost(), ctx);
    expect(res.status).toBe(200);
    expect(unsubscribeMock).toHaveBeenCalledWith("tokA");
  });

  it("원클릭 본문이 없는 POST는 400, 해지하지 않음", async () => {
    const res = await POST(oneClickPost("foo=bar"), ctx);
    expect(res.status).toBe(400);
    expect(unsubscribeMock).not.toHaveBeenCalled();
  });

  it("유효하지 않은 토큰은 404", async () => {
    unsubscribeMock.mockResolvedValue({ success: false, error: "x", code: "invalid_token" });
    const res = await POST(oneClickPost(), ctx);
    expect(res.status).toBe(404);
  });

  it("서버 오류는 500(메일 사업자가 재시도할 수 있게)", async () => {
    unsubscribeMock.mockResolvedValue({ success: false, error: "x", code: "server_error" });
    const res = await POST(oneClickPost(), ctx);
    expect(res.status).toBe(500);
  });

  it("rate limit 초과는 429 + Retry-After, 해지하지 않음", async () => {
    checkRateLimitMock.mockResolvedValue({ allowed: false, retryAfterSeconds: 30 });
    const res = await POST(oneClickPost(), ctx);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
    expect(unsubscribeMock).not.toHaveBeenCalled();
  });
});
