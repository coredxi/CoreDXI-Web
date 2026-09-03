import { describe, expect, it } from "vitest";
import { gradeAxCheck, summarizeAxCheck, type AxCheckAnswers } from "./summarize";
import { CATALOG_VERSION, objectParticle } from "./catalog";

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
    expect(summary.priorities[0]).toMatchObject({ title: "제안서·견적서 자동 초안 생성" });
    expect(summary.priorities[0]?.roadmap[0]).toBe("최근 1년 제안서·견적서 20건 정리");
    expect(summary.priorities[1]).toMatchObject({ title: "입찰 공고 탐색·서류 자동화" });
  });

  it("최대 3개까지만 우선 과제로 반환한다", () => {
    const summary = summarizeAxCheck(
      baseAnswers({ q3: ["quote", "bidding", "site_report", "maintenance_request"] })
    );

    expect(summary.priorities).toHaveLength(3);
  });

  it("카탈로그에 없는 업무는 기타(other) 카드로 대체한다", () => {
    const summary = summarizeAxCheck(baseAnswers({ q3: ["unknown-task-value"] }));

    expect(summary.priorities[0]).toMatchObject({ title: "업무 자동화 후보 진단" });
  });

  it("catalogVersion을 함께 반환한다", () => {
    const summary = summarizeAxCheck(baseAnswers());
    expect(summary.catalogVersion).toBe(CATALOG_VERSION);
  });
});

describe("summarizeAxCheck — 답변 인용(echo)", () => {
  it("선택한 업무 라벨을 그대로 인용한다", () => {
    const summary = summarizeAxCheck(baseAnswers({ q3: ["quote"] }));
    expect(summary.priorities[0]?.echo).toBe(
      "'견적·내역서·투찰 서류 작성'을 가장 시간이 많이 드는 업무로 꼽아주셨습니다."
    );
  });

  it("'기타'를 선택하고 q3Other를 입력했으면 그 텍스트를 인용한다", () => {
    const summary = summarizeAxCheck(
      baseAnswers({ q3: ["other"], q3Other: "재고 실사 정리" })
    );
    expect(summary.priorities[0]?.echo).toContain("재고 실사 정리");
  });
});

describe("summarizeAxCheck — Q1 업종 예시", () => {
  it("업종에 매핑된 예시가 있으면 industryExample을 채운다", () => {
    const summary = summarizeAxCheck(baseAnswers({ q1: "av", q3: ["quote"] }));
    expect(summary.priorities[0]?.industryExample).toContain("장비 구성표");
  });

  it("같은 업무라도 업종이 다르면 다른 예시가 나온다", () => {
    const networkSummary = summarizeAxCheck(baseAnswers({ q1: "network", q3: ["quote"] }));
    const avSummary = summarizeAxCheck(baseAnswers({ q1: "av", q3: ["quote"] }));
    expect(networkSummary.priorities[0]?.industryExample).not.toBe(
      avSummary.priorities[0]?.industryExample
    );
  });

  it("매핑이 없는 업종(위 복합)이면 industryExample이 null이다", () => {
    const summary = summarizeAxCheck(baseAnswers({ q1: "mixed", q3: ["quote"] }));
    expect(summary.priorities[0]?.industryExample).toBeNull();
  });
});

describe("summarizeAxCheck — 로드맵 분기", () => {
  it("Q5가 '흩어져 있음'이면 1주차 앞에 데이터 정리를 붙인다", () => {
    const summary = summarizeAxCheck(baseAnswers({ q3: ["quote"], q5: "scattered" }));
    expect(summary.priorities[0]?.roadmap[0]).toBe(
      "데이터 정리 1주 → 최근 1년 제안서·견적서 20건 정리"
    );
  });

  it("Q5가 ERP 등 정리된 데이터면 접두어를 붙이지 않는다", () => {
    const summary = summarizeAxCheck(baseAnswers({ q3: ["quote"], q5: "erp" }));
    expect(summary.priorities[0]?.roadmap[0]).toBe("최근 1년 제안서·견적서 20건 정리");
  });

  it("Q4가 '전혀 없음'이면 1주차 앞에 기초 교육을 붙인다", () => {
    const summary = summarizeAxCheck(baseAnswers({ q3: ["quote"], q4: "none" }));
    expect(summary.priorities[0]?.roadmap[0]).toContain("임직원 기초 교육(2시간)");
  });

  it("Q4·Q5가 둘 다 해당하면 두 접두어가 화살표로 이어진다", () => {
    const summary = summarizeAxCheck(
      baseAnswers({ q3: ["quote"], q4: "none", q5: "scattered" })
    );
    expect(summary.priorities[0]?.roadmap[0]).toBe(
      "임직원 기초 교육(2시간) → 데이터 정리 1주 → 최근 1년 제안서·견적서 20건 정리"
    );
  });

  it("Q2가 '10명 미만'이면 1개월차 앞에 SaaS 문구를 붙인다", () => {
    const summary = summarizeAxCheck(baseAnswers({ q3: ["quote"], q2: "under_10" }));
    expect(summary.priorities[0]?.roadmap[1]).toContain("전담자 없이 쓸 수 있는 SaaS");
  });

  it("Q2가 10명 이상이면 1개월차에 접두어가 붙지 않는다", () => {
    const summary = summarizeAxCheck(baseAnswers({ q3: ["quote"], q2: "30_to_100" }));
    expect(summary.priorities[0]?.roadmap[1]).toBe(
      "표준 템플릿 3종 확정 후 AI 초안 도구로 파일럿 5건 작성"
    );
  });

  it("3개월차는 분기와 무관하게 카탈로그 원본을 그대로 쓴다", () => {
    const summary = summarizeAxCheck(
      baseAnswers({ q3: ["quote"], q2: "under_10", q4: "none", q5: "scattered" })
    );
    expect(summary.priorities[0]?.roadmap[2]).toBe(
      "실제 제안 건에 적용해 작성 시간 정착, 월별 절감 시간 측정"
    );
  });
});

describe("summarizeAxCheck — Q6 톤 + 효과 면책 문구", () => {
  it("Q6에 따라 expectedEffect에 톤 접미사가 붙고, 면책 문구가 항상 함께 붙는다", () => {
    const summary = summarizeAxCheck(baseAnswers({ q3: ["quote"], q6: "cost" }));
    expect(summary.priorities[0]?.expectedEffect).toBe(
      "작성 시간 40~60%↓ (인건비·야근 절감 관점) (일반적 도입 사례 기준, 실제 효과는 상담 후 안내)"
    );
  });
});

describe("summarizeAxCheck — 서로 다른 조합의 개인화 체감", () => {
  it("Q1·Q2·Q4 조합이 다른 3세트가 눈에 띄게 다른 결과를 낸다", () => {
    // 세 조합은 로드맵 분기 조건(Q4="none" → 1주차 접두어, Q2="under_10" → 1개월차 접두어)을
    // 각각 다르게 걸치도록 골랐다 — 셋 다 분기를 벗어나면(예: integrated/over_100 vs team/30_to_100)
    // 접두어 없는 동일한 기본 로드맵으로 수렴해 버려 구분되지 않는다.
    const a = summarizeAxCheck(
      baseAnswers({ q1: "network", q2: "under_10", q4: "none", q3: ["quote"] })
    );
    const b = summarizeAxCheck(
      baseAnswers({ q1: "av", q2: "30_to_100", q4: "none", q3: ["quote"] })
    );
    const c = summarizeAxCheck(
      baseAnswers({ q1: "it_si", q2: "under_10", q4: "team", q3: ["quote"] })
    );

    const roadmaps = [a, b, c].map((s) => s.priorities[0]?.roadmap.join("|"));
    const industryExamples = [a, b, c].map((s) => s.priorities[0]?.industryExample);

    expect(new Set(roadmaps).size).toBe(3);
    expect(new Set(industryExamples).size).toBe(3);
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

describe("objectParticle — 목적격 조사(을/를) 받침 판정", () => {
  it("받침이 있는 명사는 '을'을 붙인다", () => {
    expect(objectParticle("견적·내역서·투찰 서류 작성")).toBe("을"); // '성' 받침 ㅇ
    expect(objectParticle("관리")).not.toBe("을"); // 대조군: 받침 없음
  });

  it("받침이 없는 명사는 '를'을 붙인다", () => {
    expect(objectParticle("나라장터 입찰 공고 탐색·적격심사 서류 준비")).toBe("를"); // '비' 받침 없음
    expect(objectParticle("A/S·하자보수·월정기 점검 이력 관리")).toBe("를"); // '리' 받침 없음
  });

  it("한글이 아닌 문자로 끝나면 '를'로 안전하게 기본값 처리한다", () => {
    expect(objectParticle("기타 업무 ABC")).toBe("를");
  });
});
