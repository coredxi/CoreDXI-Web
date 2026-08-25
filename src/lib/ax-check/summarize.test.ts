import { describe, expect, it } from "vitest";
import { gradeAxCheck, summarizeAxCheck, type AxCheckAnswers } from "./summarize";
import { CATALOG_VERSION } from "./catalog";

function baseAnswers(overrides: Partial<AxCheckAnswers> = {}): AxCheckAnswers {
  return {
    q1: "network",
    q2: "10_to_30",
    q3: ["quote", "bidding"],
    q4: "personal",
    q5: "files",
    q6: "speed",
    q7: "within_3_months",
    q8: "self_decide",
    ...overrides,
  };
}

describe("gradeAxCheck", () => {
  it("HOT: 임박한 시점 + 결정 권한 + 업무 2개 이상 선택", () => {
    expect(
      gradeAxCheck({ q3: ["quote", "bidding"], q7: "this_year", q8: "ceo_report" })
    ).toBe("HOT");
  });

  it("WARM: 검토 의사는 있지만 HOT 조건을 충족하지 못함 (업무 1개만 선택)", () => {
    expect(
      gradeAxCheck({ q3: ["quote"], q7: "within_3_months", q8: "self_decide" })
    ).toBe("WARM");
  });

  it("WARM: 결정 권한이 없어 HOT이 아님(내년 이후 검토)", () => {
    expect(
      gradeAxCheck({ q3: ["quote", "bidding"], q7: "next_year", q8: "undecided" })
    ).toBe("WARM");
  });

  it("COLD: 아직 정보 수집 단계", () => {
    expect(
      gradeAxCheck({ q3: ["quote", "bidding"], q7: "info_gathering", q8: "self_decide" })
    ).toBe("COLD");
  });
});

describe("summarizeAxCheck — Q3 과제 매핑", () => {
  it("선택한 업무마다 카탈로그의 과제 카드를 매핑한다", () => {
    const summary = summarizeAxCheck(baseAnswers({ q3: ["quote", "bidding"] }));

    expect(summary.priorities).toHaveLength(2);
    expect(summary.priorities[0]).toMatchObject({
      title: "제안서·견적서 자동 초안 생성",
      firstStep: "최근 1년 제안서·견적서 20건 정리",
    });
    expect(summary.priorities[1]).toMatchObject({
      title: "입찰 공고 탐색·서류 자동화",
    });
  });

  it("최대 3개까지만 우선 과제로 반환한다", () => {
    const summary = summarizeAxCheck(
      baseAnswers({
        q3: ["quote", "bidding", "site_report", "maintenance_request"],
      })
    );

    expect(summary.priorities).toHaveLength(3);
  });

  it("카탈로그에 없는 업무는 기타(other) 카드로 대체한다", () => {
    const summary = summarizeAxCheck(baseAnswers({ q3: ["unknown-task-value"] }));

    expect(summary.priorities[0]).toMatchObject({
      title: "업무 자동화 후보 진단",
    });
  });

  it("catalogVersion을 함께 반환한다", () => {
    const summary = summarizeAxCheck(baseAnswers());
    expect(summary.catalogVersion).toBe(CATALOG_VERSION);
  });
});

describe("summarizeAxCheck — Q5 데이터 정리 분기", () => {
  it("Q5가 '흩어져 있음'이면 firstStep 앞에 데이터 정리 1주를 붙인다", () => {
    const summary = summarizeAxCheck(baseAnswers({ q3: ["quote"], q5: "scattered" }));
    expect(summary.priorities[0]?.firstStep).toBe(
      "데이터 정리 1주 → 최근 1년 제안서·견적서 20건 정리"
    );
  });

  it("Q5가 '잘 모르겠음'이어도 동일하게 데이터 정리 1주를 붙인다", () => {
    const summary = summarizeAxCheck(baseAnswers({ q3: ["quote"], q5: "unknown" }));
    expect(summary.priorities[0]?.firstStep).toContain("데이터 정리 1주 →");
  });

  it("Q5가 ERP 등 정리된 데이터면 접두어를 붙이지 않는다", () => {
    const summary = summarizeAxCheck(baseAnswers({ q3: ["quote"], q5: "erp" }));
    expect(summary.priorities[0]?.firstStep).toBe("최근 1년 제안서·견적서 20건 정리");
  });
});

describe("summarizeAxCheck — Q6 톤 반영", () => {
  it("Q6에 따라 expectedEffect에 톤 접미사가 붙는다", () => {
    const summary = summarizeAxCheck(baseAnswers({ q3: ["quote"], q6: "cost" }));
    expect(summary.priorities[0]?.expectedEffect).toBe(
      "작성 시간 50%↓ (인건비·야근 절감 관점)"
    );
  });
});

describe("summarizeAxCheck — score", () => {
  it("등급이 높을수록, 선택한 업무가 많을수록 점수가 높다", () => {
    const hot = summarizeAxCheck(
      baseAnswers({ q3: ["quote", "bidding"], q7: "within_3_months", q8: "self_decide" })
    );
    const warm = summarizeAxCheck(
      baseAnswers({ q3: ["quote"], q7: "next_year", q8: "undecided" })
    );
    const cold = summarizeAxCheck(
      baseAnswers({ q3: ["quote"], q7: "info_gathering", q8: "undecided" })
    );

    expect(hot.score).toBeGreaterThan(warm.score);
    expect(warm.score).toBeGreaterThan(cold.score);
  });
});
