import { beforeEach, describe, expect, it, vi } from "vitest";

const sendResendEmailMock = vi.fn();
vi.mock("@/lib/resend", () => ({
  sendResendEmail: (...args: unknown[]) => sendResendEmailMock(...args),
}));

const captureExceptionMock = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  captureException: (...args: unknown[]) => captureExceptionMock(...args),
}));

const prismaMock = {
  axCheckResponse: {
    updateMany: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { CLAIM_LOST_ERROR, isFollowupEnabled, processDueFollowups, sendFollowupEmail } =
  await import("./followup");

function baseRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "lead-1",
    company: "테스트회사",
    name: "홍길동",
    email: "user@example.com",
    answers: {
      q1: "network",
      q2: "10_to_30",
      q3: ["quote"],
      q4: "personal",
      q5: "files",
      q6: "speed",
      q7: "within_3_months",
      q8: "self_decide",
    },
    catalogVersion: "v2",
    grade: "HOT",
    score: 320,
    summary: {
      priorities: [
        {
          title: "제안서·견적서 자동 초안 생성",
          why: "이유",
          echo: "echo",
          industryExample: null,
          roadmap: ["1주차", "1개월차", "3개월차"],
          expectedEffect: "효과",
        },
      ],
    },
    followupSubject: null,
    followupBody: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.AX_CHECK_FOLLOWUP_ENABLED;
  sendResendEmailMock.mockResolvedValue({ success: true });
});

describe("isFollowupEnabled", () => {
  it("환경변수가 없으면 true", () => {
    expect(isFollowupEnabled()).toBe(true);
  });

  it("AX_CHECK_FOLLOWUP_ENABLED=false면 false", () => {
    process.env.AX_CHECK_FOLLOWUP_ENABLED = "false";
    expect(isFollowupEnabled()).toBe(false);
  });
});

describe("sendFollowupEmail", () => {
  it("선점(claim)에 실패하면 발송하지 않는다", async () => {
    prismaMock.axCheckResponse.updateMany.mockResolvedValue({ count: 0 });

    const result = await sendFollowupEmail("lead-1");

    expect(result).toEqual({ success: false, error: CLAIM_LOST_ERROR });
    expect(sendResendEmailMock).not.toHaveBeenCalled();
  });

  it("followupSubject/Body(override)가 있으면 그대로 발송한다", async () => {
    prismaMock.axCheckResponse.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.axCheckResponse.findUnique.mockResolvedValue(
      baseRecord({ followupSubject: "관리자 수정 제목", followupBody: "관리자 수정 본문" })
    );
    prismaMock.axCheckResponse.update.mockResolvedValue({});

    await sendFollowupEmail("lead-1");

    expect(sendResendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "관리자 수정 제목", text: "관리자 수정 본문" })
    );
  });

  it("override가 없으면 mode:auto로 생성한 초안에는 플레이스홀더가 없다", async () => {
    prismaMock.axCheckResponse.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.axCheckResponse.findUnique.mockResolvedValue(baseRecord());
    prismaMock.axCheckResponse.update.mockResolvedValue({});

    await sendFollowupEmail("lead-1");

    const call = sendResendEmailMock.mock.calls[0]![0];
    expect(call.text).not.toMatch(/\[\[.*\]\]/);
    expect(call.to).toBe("user@example.com");
  });

  it("text와 함께 로고가 포함된 html도 같이 보낸다(override·생성 초안 둘 다)", async () => {
    prismaMock.axCheckResponse.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.axCheckResponse.findUnique.mockResolvedValue(baseRecord());
    prismaMock.axCheckResponse.update.mockResolvedValue({});

    await sendFollowupEmail("lead-1");

    const call = sendResendEmailMock.mock.calls[0]![0];
    expect(call.html).toContain("/brand/email-logo.png");
    expect(call.html).toContain(call.text.split("\n")[0]); // 본문 첫 줄 내용이 html에도 있어야 함
  });

  it("성공하면 SENT로 갱신한다", async () => {
    prismaMock.axCheckResponse.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.axCheckResponse.findUnique.mockResolvedValue(baseRecord());
    prismaMock.axCheckResponse.update.mockResolvedValue({});

    const result = await sendFollowupEmail("lead-1");

    expect(result).toEqual({ success: true });
    expect(prismaMock.axCheckResponse.update).toHaveBeenCalledWith({
      where: { id: "lead-1" },
      data: expect.objectContaining({ followupStatus: "SENT", followupError: null }),
    });
  });

  it("발송 실패 시 FAILED + attempts 증가 + Sentry 캡처", async () => {
    prismaMock.axCheckResponse.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.axCheckResponse.findUnique.mockResolvedValue(baseRecord());
    prismaMock.axCheckResponse.update.mockResolvedValue({});
    sendResendEmailMock.mockResolvedValue({ success: false, error: "resend down" });

    const result = await sendFollowupEmail("lead-1");

    expect(result).toEqual({ success: false, error: "resend down" });
    expect(prismaMock.axCheckResponse.update).toHaveBeenCalledWith({
      where: { id: "lead-1" },
      data: {
        followupStatus: "FAILED",
        followupError: "resend down",
        followupAttempts: { increment: 1 },
      },
    });
    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ tags: { feature: "ax-check-followup" } })
    );
  });

  it("force:true면 SENT 상태여도 다시 선점한다", async () => {
    prismaMock.axCheckResponse.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.axCheckResponse.findUnique.mockResolvedValue(baseRecord());
    prismaMock.axCheckResponse.update.mockResolvedValue({});

    await sendFollowupEmail("lead-1", { force: true });

    expect(prismaMock.axCheckResponse.updateMany).toHaveBeenCalledWith({
      where: { id: "lead-1", followupStatus: { in: ["SCHEDULED", "HELD", "SENT", "FAILED", "SKIPPED"] } },
      data: { followupStatus: "SENDING" },
    });
  });

  it("선점 이후 findUnique가 예외를 던지면 FAILED로 복구 기록하고 Sentry에 캡처한다", async () => {
    prismaMock.axCheckResponse.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.axCheckResponse.findUnique.mockRejectedValue(new Error("db unreachable"));
    prismaMock.axCheckResponse.update.mockResolvedValue({});

    const result = await sendFollowupEmail("lead-1");

    expect(result).toEqual({ success: false, error: "db unreachable" });
    expect(prismaMock.axCheckResponse.update).toHaveBeenCalledWith({
      where: { id: "lead-1" },
      data: {
        followupStatus: "FAILED",
        followupError: "db unreachable",
        followupAttempts: { increment: 1 },
      },
    });
    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ tags: { feature: "ax-check-followup" } })
    );
  });

  it("발송 성공 후 SENT로 갱신하는 update가 예외를 던지면 FAILED로 복구 기록한다(재시도 시 중복 발송 가능성은 수용된 트레이드오프)", async () => {
    prismaMock.axCheckResponse.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.axCheckResponse.findUnique.mockResolvedValue(baseRecord());
    prismaMock.axCheckResponse.update
      .mockRejectedValueOnce(new Error("write failed after send"))
      .mockResolvedValueOnce({});

    const result = await sendFollowupEmail("lead-1");

    expect(result).toEqual({ success: false, error: "write failed after send" });
    expect(prismaMock.axCheckResponse.update).toHaveBeenNthCalledWith(2, {
      where: { id: "lead-1" },
      data: {
        followupStatus: "FAILED",
        followupError: "write failed after send",
        followupAttempts: { increment: 1 },
      },
    });
    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ tags: { feature: "ax-check-followup" } })
    );
  });

  it("복구 기록 write마저 실패하면 예외를 삼키고 별도 태그로 Sentry에 캡처한다", async () => {
    prismaMock.axCheckResponse.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.axCheckResponse.findUnique.mockRejectedValue(new Error("db unreachable"));
    prismaMock.axCheckResponse.update.mockRejectedValue(new Error("recovery write also failed"));

    const result = await sendFollowupEmail("lead-1");

    expect(result).toEqual({ success: false, error: "db unreachable" });
    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ tags: { feature: "ax-check-followup" } })
    );
    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ tags: { feature: "ax-check-followup-recovery" } })
    );
  });
});

describe("processDueFollowups", () => {
  it("킬 스위치가 꺼져 있으면 조회 없이 즉시 반환한다", async () => {
    process.env.AX_CHECK_FOLLOWUP_ENABLED = "false";

    const result = await processDueFollowups();

    expect(result).toEqual({ processed: 0, sent: 0, failed: 0, skipped: 0 });
    expect(prismaMock.axCheckResponse.findMany).not.toHaveBeenCalled();
  });

  it("SCHEDULED·FAILED(3회 미만)만 대상으로 조회한다", async () => {
    prismaMock.axCheckResponse.findMany.mockResolvedValue([]);

    await processDueFollowups({ now: new Date("2026-09-04T00:30:00Z") });

    expect(prismaMock.axCheckResponse.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { followupStatus: "SCHEDULED", followupScheduledAt: { lte: new Date("2026-09-04T00:30:00Z") } },
            {
              followupStatus: "FAILED",
              followupScheduledAt: { lte: new Date("2026-09-04T00:30:00Z") },
              followupAttempts: { lt: 3 },
            },
          ],
        },
      })
    );
  });

  it("대상 건을 처리해 sent/failed/processed 카운트를 반환한다", async () => {
    prismaMock.axCheckResponse.findMany.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    prismaMock.axCheckResponse.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.axCheckResponse.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(
        baseRecord({
          id: where.id,
          followupSubject: "제목",
          followupBody: "본문",
        })
      )
    );
    prismaMock.axCheckResponse.update.mockResolvedValue({});
    sendResendEmailMock.mockResolvedValueOnce({ success: true }).mockResolvedValueOnce({
      success: false,
      error: "boom",
    });

    const result = await processDueFollowups();

    expect(result).toEqual({ processed: 2, sent: 1, failed: 1, skipped: 0 });
  });

  it("선점에 실패한 건은 skipped로 집계한다", async () => {
    prismaMock.axCheckResponse.findMany.mockResolvedValue([{ id: "a" }]);
    prismaMock.axCheckResponse.updateMany.mockResolvedValue({ count: 0 });

    const result = await processDueFollowups();

    expect(result).toEqual({ processed: 1, sent: 0, failed: 0, skipped: 1 });
  });

  it("15분 넘게 SENDING으로 멈춘 행을 due 조회 전에 FAILED로 회수한다", async () => {
    prismaMock.axCheckResponse.findMany.mockResolvedValue([]);
    prismaMock.axCheckResponse.updateMany.mockResolvedValue({ count: 1 });
    const now = new Date("2026-09-04T00:30:00Z");

    await processDueFollowups({ now });

    // 회수 updateMany가 첫 호출이고, due 조회(findMany)보다 먼저 일어난다.
    expect(prismaMock.axCheckResponse.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        followupStatus: "SENDING",
        updatedAt: { lt: new Date(now.getTime() - 15 * 60 * 1000) },
      },
      data: {
        followupStatus: "FAILED",
        followupError: "발송 처리 중 프로세스가 중단되어 자동 복구되었습니다.",
        followupAttempts: { increment: 1 },
      },
    });
    expect(
      prismaMock.axCheckResponse.updateMany.mock.invocationCallOrder[0]!
    ).toBeLessThan(prismaMock.axCheckResponse.findMany.mock.invocationCallOrder[0]!);
  });

  it("오래된 SENDING만 회수하고 최근 SENDING 행은 그대로 둔다", async () => {
    const now = new Date("2026-09-04T00:30:00Z");
    // 가짜 DB — updateMany의 where를 실제로 적용해 어떤 행이 회수되는지 확인한다.
    const rows = [
      {
        id: "stale",
        followupStatus: "SENDING",
        updatedAt: new Date(now.getTime() - 30 * 60 * 1000), // 30분 전 → 회수 대상
        followupAttempts: 0,
        followupError: null as string | null,
      },
      {
        id: "fresh",
        followupStatus: "SENDING",
        updatedAt: new Date(now.getTime() - 5 * 60 * 1000), // 5분 전 → 아직 진행 중일 수 있음
        followupAttempts: 0,
        followupError: null as string | null,
      },
    ];
    prismaMock.axCheckResponse.findMany.mockResolvedValue([]);
    prismaMock.axCheckResponse.updateMany.mockImplementation(
      ({
        where,
        data,
      }: {
        where: { followupStatus: string; updatedAt: { lt: Date } };
        data: { followupStatus: string; followupError: string; followupAttempts: { increment: number } };
      }) => {
        const matched = rows.filter(
          (r) => r.followupStatus === where.followupStatus && r.updatedAt < where.updatedAt.lt
        );
        for (const row of matched) {
          row.followupStatus = data.followupStatus;
          row.followupError = data.followupError;
          row.followupAttempts += data.followupAttempts.increment;
        }
        return Promise.resolve({ count: matched.length });
      }
    );

    const result = await processDueFollowups({ now });

    expect(rows[0]).toMatchObject({
      id: "stale",
      followupStatus: "FAILED",
      followupError: "발송 처리 중 프로세스가 중단되어 자동 복구되었습니다.",
      followupAttempts: 1,
    });
    expect(rows[1]).toMatchObject({ id: "fresh", followupStatus: "SENDING", followupAttempts: 0 });
    // 방금 회수한 행을 같은 실행에서 곧바로 재발송하지 않는다.
    expect(sendResendEmailMock).not.toHaveBeenCalled();
    expect(result).toEqual({ processed: 0, sent: 0, failed: 0, skipped: 0 });
  });
});
