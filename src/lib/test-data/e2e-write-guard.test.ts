import { describe, expect, it } from "vitest";
import { evaluateWriteGuard, extractDbHost } from "./e2e-write-guard";

const URL_WITH_SECRET = "postgresql://dbuser:s3cret-pass@db.prod.example.com:6543/postgres";

describe("extractDbHost", () => {
  it("호스트만 반환하고 사용자명·비밀번호는 포함하지 않는다", () => {
    const host = extractDbHost(URL_WITH_SECRET);
    expect(host).toBe("db.prod.example.com");
    expect(host).not.toContain("dbuser");
    expect(host).not.toContain("s3cret");
  });

  it("비어 있거나 파싱할 수 없으면 null", () => {
    expect(extractDbHost(undefined)).toBeNull();
    expect(extractDbHost("")).toBeNull();
    expect(extractDbHost("not a url")).toBeNull();
  });
});

describe("evaluateWriteGuard", () => {
  it("E2E_ALLOW_WRITES가 없으면 차단하고 현재 호스트를 알려 준다", () => {
    const d = evaluateWriteGuard({ allowWrites: undefined, confirmHost: undefined, databaseUrl: URL_WITH_SECRET });
    expect(d.allowed).toBe(false);
    if (!d.allowed) {
      expect(d.reason).toContain("쓰기 E2E는 기본 차단");
      expect(d.reason).toContain("현재 DB 호스트: db.prod.example.com");
      expect(d.reason).not.toContain("s3cret");
      expect(d.reason).not.toContain("dbuser");
    }
  });

  it("E2E_ALLOW_WRITES가 1이 아니면(true 등) 차단", () => {
    expect(
      evaluateWriteGuard({ allowWrites: "true", confirmHost: "db.prod.example.com", databaseUrl: URL_WITH_SECRET })
        .allowed
    ).toBe(false);
  });

  it("허용했어도 확인 호스트가 비어 있으면 차단", () => {
    expect(
      evaluateWriteGuard({ allowWrites: "1", confirmHost: undefined, databaseUrl: URL_WITH_SECRET }).allowed
    ).toBe(false);
  });

  it("허용했어도 확인 호스트가 다르면 차단", () => {
    expect(
      evaluateWriteGuard({ allowWrites: "1", confirmHost: "db.prod.example", databaseUrl: URL_WITH_SECRET }).allowed
    ).toBe(false);
  });

  it("DB 호스트를 알 수 없으면 허용하지 않는다", () => {
    expect(evaluateWriteGuard({ allowWrites: "1", confirmHost: "x", databaseUrl: undefined }).allowed).toBe(false);
  });

  it("허용 + 호스트 정확히 일치할 때만 실행", () => {
    expect(
      evaluateWriteGuard({ allowWrites: "1", confirmHost: "db.prod.example.com", databaseUrl: URL_WITH_SECRET })
    ).toEqual({ allowed: true });
  });
});
