import { beforeEach, describe, expect, it, vi } from "vitest";

const processDueIssuesMock = vi.fn();
vi.mock("@/lib/newsletter/send", () => ({ processDueIssues: (...a: unknown[]) => processDueIssuesMock(...a) }));
const captureMessageMock = vi.fn();
vi.mock("@sentry/nextjs", () => ({ captureMessage: (...a: unknown[]) => captureMessageMock(...a) }));

const { GET } = await import("./route");
const req = (auth?: string) =>
  new Request("https://www.coredxi.com/api/cron/newsletter-send", { headers: auth ? { authorization: auth } : {} });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "s3cret";
  processDueIssuesMock.mockResolvedValue({ processed: 1, sent: 1, failed: 0, recovered: 0 });
});

describe("GET /api/cron/newsletter-send", () => {
  it("인증 실패 시 401, 발송 로직 미호출", async () => {
    expect((await GET(req())).status).toBe(401);
    expect(processDueIssuesMock).not.toHaveBeenCalled();
  });

  it("성공 시 결과를 돌려준다", async () => {
    const body = await (await GET(req("Bearer s3cret"))).json();
    expect(body).toMatchObject({ ok: true, processed: 1, sent: 1 });
  });

  it("실패·회수가 있으면 Sentry 경고", async () => {
    processDueIssuesMock.mockResolvedValue({ processed: 1, sent: 0, failed: 1, recovered: 1 });
    await GET(req("Bearer s3cret"));
    expect(captureMessageMock).toHaveBeenCalledWith(expect.stringContaining("newsletter send"), "warning");
  });
});
