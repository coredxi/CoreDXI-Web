import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ addBreadcrumb: vi.fn() }));

const prismaMock = {
  axCheckResponse: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
  },
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

/** supabase-js 쿼리 빌더 흉내: 체인 메서드는 자기 자신을 돌려주고, await하면 result를 준다. */
type QueryResult = { data?: unknown; error: unknown };
type Builder = {
  select: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  ilike: ReturnType<typeof vi.fn>;
  like: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  then: (resolve: (v: QueryResult) => unknown, reject?: (e: unknown) => unknown) => Promise<unknown>;
};
function makeBuilder(result: QueryResult): Builder {
  const b = {} as Builder;
  for (const m of ["select", "delete", "in", "ilike", "like", "order"] as const) {
    b[m] = vi.fn(() => b);
  }
  b.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return b;
}

let selectBuilder: Builder;
let deleteBuilder: Builder;
const fromMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdmin: () => ({ from: fromMock }),
}));

const { previewTestData, cleanupTestData } = await import("./test-data-cleanup");

const SUPER_ADMIN = { user: { accountType: "admin", role: "SUPER_ADMIN" } };
const EDITOR = { user: { accountType: "admin", role: "EDITOR" } };

const e2eContact = {
  id: "c-e2e",
  email: "e2e-1762590000000@example.com",
  message: "[E2E TEST] Playwright 골든패스 자동 테스트 문의입니다.",
  created_at: "2026-11-08T13:00:00Z",
};
const realContactSameEmailPattern = {
  id: "c-real",
  email: "e2e-real@example.com",
  message: "실제 도입 상담 문의",
  created_at: "2026-11-01T00:00:00Z",
};

beforeEach(() => {
  authMock.mockReset();
  prismaMock.axCheckResponse.findMany.mockReset();
  prismaMock.axCheckResponse.deleteMany.mockReset().mockResolvedValue({ count: 0 });
  selectBuilder = makeBuilder({ data: [], error: null });
  deleteBuilder = makeBuilder({ error: null });
  fromMock.mockReset().mockImplementation(() => ({
    select: selectBuilder.select,
    delete: deleteBuilder.delete,
  }));
});

describe("권한", () => {
  it.each([
    ["비로그인", null],
    ["EDITOR", EDITOR],
  ])("%s은 미리보기·정리 모두 거부되고 DB를 건드리지 않는다", async (_label, session) => {
    authMock.mockResolvedValue(session);

    const preview = await previewTestData("leads");
    const cleanup = await cleanupTestData("contacts");

    expect(preview.success).toBe(false);
    expect(cleanup.success).toBe(false);
    expect(prismaMock.axCheckResponse.findMany).not.toHaveBeenCalled();
    expect(fromMock).not.toHaveBeenCalled();
  });
});

describe("리드 정리", () => {
  it("서버에서 다시 찾은 대상만, 조건을 붙여 지운다 — ref=sales-kim 리드는 제외", async () => {
    authMock.mockResolvedValue(SUPER_ADMIN);
    prismaMock.axCheckResponse.findMany.mockResolvedValue([
      { id: "l-e2e", refCode: "e2e", company: "[E2E TEST] AX체크회사 1", createdAt: new Date("2026-11-08T13:00:00Z") },
      // DB 조건을 뚫고 들어왔다고 가정한 실제 리드 — 순수 함수 2차 확인에서 걸러져야 한다
      { id: "l-real", refCode: "sales-kim", company: "[E2E TEST] 미디소프트", createdAt: new Date("2026-09-30T00:00:00Z") },
    ]);

    const result = await cleanupTestData("leads");

    expect(result).toEqual({ success: true, deletedIds: ["l-e2e"] });
    expect(prismaMock.axCheckResponse.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { refCode: "e2e", company: { startsWith: "[E2E TEST]" } } })
    );
    expect(prismaMock.axCheckResponse.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["l-e2e"] }, refCode: "e2e", company: { startsWith: "[E2E TEST]" } },
    });
  });

  it("대상이 0건이면 삭제를 호출하지 않는다", async () => {
    authMock.mockResolvedValue(SUPER_ADMIN);
    prismaMock.axCheckResponse.findMany.mockResolvedValue([]);

    const result = await cleanupTestData("leads");

    expect(result).toEqual({ success: true, deletedIds: [] });
    expect(prismaMock.axCheckResponse.deleteMany).not.toHaveBeenCalled();
  });

  it("미리보기는 건수와 회사명·제출일을 돌려준다", async () => {
    authMock.mockResolvedValue(SUPER_ADMIN);
    prismaMock.axCheckResponse.findMany.mockResolvedValue([
      { id: "l-e2e", refCode: "e2e", company: "[E2E TEST] AX체크회사 1", createdAt: new Date("2026-11-08T13:00:00Z") },
    ]);

    const result = await previewTestData("leads");

    expect(result).toEqual({
      success: true,
      preview: {
        total: 1,
        samples: [{ id: "l-e2e", label: "[E2E TEST] AX체크회사 1", createdAt: "2026-11-08T13:00:00.000Z" }],
      },
    });
  });
});

describe("문의 정리", () => {
  it("이메일·[E2E TEST] 둘 다 맞는 문의만 지운다 — 표식 없는 e2e- 이메일 문의는 제외", async () => {
    authMock.mockResolvedValue(SUPER_ADMIN);
    selectBuilder = makeBuilder({ data: [e2eContact, realContactSameEmailPattern], error: null });

    const result = await cleanupTestData("contacts");

    expect(result).toEqual({ success: true, deletedIds: ["c-e2e"] });
    expect(selectBuilder.ilike).toHaveBeenCalledWith("email", "e2e-%@example.com");
    expect(selectBuilder.like).toHaveBeenCalledWith("message", "%[E2E TEST]%");
    expect(deleteBuilder.in).toHaveBeenCalledWith("id", ["c-e2e"]);
    expect(deleteBuilder.ilike).toHaveBeenCalledWith("email", "e2e-%@example.com");
    expect(deleteBuilder.like).toHaveBeenCalledWith("message", "%[E2E TEST]%");
  });

  it("조회 오류면 삭제하지 않고 실패를 돌려준다", async () => {
    authMock.mockResolvedValue(SUPER_ADMIN);
    selectBuilder = makeBuilder({ data: null, error: { message: "boom" } });

    const result = await cleanupTestData("contacts");

    expect(result.success).toBe(false);
    expect(deleteBuilder.delete).not.toHaveBeenCalled();
  });
});
