import { beforeEach, describe, expect, it, vi } from "vitest";

const processDueFollowupsMock = vi.fn();
vi.mock("@/lib/ax-check/followup", () => ({
  processDueFollowups: (...args: unknown[]) => processDueFollowupsMock(...args),
}));

const captureMessageMock = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  captureMessage: (...args: unknown[]) => captureMessageMock(...args),
}));

const { GET } = await import("./route");

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "test-secret";
  processDueFollowupsMock.mockResolvedValue({ processed: 0, sent: 0, failed: 0, skipped: 0 });
});

describe("GET /api/cron/ax-check-followup", () => {
  it("Authorization 헤더가 없으면 401을 반환한다", async () => {
    const request = new Request("http://localhost/api/cron/ax-check-followup");
    const response = await GET(request);

    expect(response.status).toBe(401);
    expect(processDueFollowupsMock).not.toHaveBeenCalled();
  });

  it("시크릿이 틀리면 401을 반환한다", async () => {
    const request = new Request("http://localhost/api/cron/ax-check-followup", {
      headers: { authorization: "Bearer wrong" },
    });
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("CRON_SECRET이 설정되어 있지 않으면 401을 반환한다", async () => {
    delete process.env.CRON_SECRET;
    const request = new Request("http://localhost/api/cron/ax-check-followup", {
      headers: { authorization: "Bearer test-secret" },
    });
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("유효한 요청이면 처리 결과를 JSON으로 반환한다", async () => {
    processDueFollowupsMock.mockResolvedValue({ processed: 3, sent: 2, failed: 1, skipped: 0 });
    const request = new Request("http://localhost/api/cron/ax-check-followup", {
      headers: { authorization: "Bearer test-secret" },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, processed: 3, sent: 2, failed: 1, skipped: 0 });
    expect(captureMessageMock).toHaveBeenCalledWith("ax-check followup: 1 failed", "warning");
  });

  it("실패가 없으면 Sentry를 호출하지 않는다", async () => {
    processDueFollowupsMock.mockResolvedValue({ processed: 2, sent: 2, failed: 0, skipped: 0 });
    const request = new Request("http://localhost/api/cron/ax-check-followup", {
      headers: { authorization: "Bearer test-secret" },
    });

    await GET(request);

    expect(captureMessageMock).not.toHaveBeenCalled();
  });
});
