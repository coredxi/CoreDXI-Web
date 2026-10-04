import { describe, expect, it } from "vitest";
import { ensureAdPrefix, renderSubjectTemplate } from "./subject";

describe("renderSubjectTemplate", () => {
  it("{{issueDate}}·{{issueNo}}를 KST 날짜·회차로 치환", () => {
    expect(
      renderSubjectTemplate("(광고) [AX 위클리 #{{issueNo}}] {{issueDate}} 소식", {
        issueNo: 3,
        issueDate: new Date("2026-10-05T15:00:00Z"),
      })
    ).toBe("(광고) [AX 위클리 #3] 2026-10-06 소식");
  });
});

describe("ensureAdPrefix", () => {
  it("(광고)가 없으면 앞에 붙인다", () => {
    expect(ensureAdPrefix("[AX 위클리] 소식")).toBe("(광고) [AX 위클리] 소식");
  });

  it("이미 있으면(앞 공백 포함) 중복으로 붙이지 않는다", () => {
    expect(ensureAdPrefix("  (광고) [AX 위클리]")).toBe("(광고) [AX 위클리]");
  });

  it("[테스트] 접두가 있어도 (광고)를 맨 앞에 둔다", () => {
    expect(ensureAdPrefix("[테스트] (광고) 소식")).toBe("(광고) [테스트] 소식");
  });
});
