import { describe, expect, it } from "vitest";
import { buildCustomerEmailDraft } from "./email-draft";
import { SALES_SIGNATURE } from "./catalog";
import type { AxCheckAnswers, AxCheckSummary } from "./summarize";

function baseAnswers(overrides: Partial<AxCheckAnswers> = {}): AxCheckAnswers {
  return {
    q1: "network",
    q2: "10_to_30",
    q3: ["quote"],
    q4: "personal",
    q5: "files",
    q6: "speed",
    q7: "within_3_months",
    q8: "self_decide",
    ...overrides,
  };
}

function baseSummary(overrides: Partial<AxCheckSummary> = {}): AxCheckSummary {
  return {
    priorities: [
      {
        title: "제안서·견적서 자동 초안 생성",
        why: "과거 제안서·견적 데이터를 기반으로 반복 작성 시간을 줄일 수 있습니다.",
        echo: "'제안서·견적서 작성'을(를) 가장 시간이 많이 드는 업무로 꼽아주셨습니다.",
        industryExample: "예: BOM·회선 구성 기반 제안 초안 자동 생성",
        roadmap: [
          "최근 1년 제안서·견적서 20건 정리",
          "표준 템플릿 3종 확정 후 AI 초안 도구로 파일럿 5건 작성",
          "실제 제안 건에 적용해 작성 시간 정착, 월별 절감 시간 측정",
        ],
        expectedEffect: "작성 시간 40~60%↓ (일반적 도입 사례 기준, 실제 효과는 상담 후 안내)",
      },
    ],
    grade: "HOT",
    score: 320,
    catalogVersion: "v2-draft",
    ...overrides,
  };
}

describe("buildCustomerEmailDraft", () => {
  it("제목에 회사명을 포함한다", () => {
    const draft = buildCustomerEmailDraft(
      baseAnswers(),
      baseSummary(),
      { company: "테스트회사", name: "홍길동" }
    );
    expect(draft.subject).toBe("[CoreDXI] 테스트회사 AX 체크 결과 — 귀사의 우선 과제 3가지");
  });

  it("본문에 회사명·성함 인사말이 들어간다", () => {
    const draft = buildCustomerEmailDraft(
      baseAnswers(),
      baseSummary(),
      { company: "테스트회사", name: "홍길동" }
    );
    expect(draft.body).toContain("테스트회사 홍길동님, 안녕하세요.");
  });

  it("우선 과제 제목·첫 단계·기대 효과가 본문에 포함된다", () => {
    const draft = buildCustomerEmailDraft(
      baseAnswers(),
      baseSummary(),
      { company: "테스트회사", name: "홍길동" }
    );
    expect(draft.body).toContain("제안서·견적서 자동 초안 생성");
    expect(draft.body).toContain("최근 1년 제안서·견적서 20건 정리");
    expect(draft.body).toContain("작성 시간 40~60%↓");
  });

  it("CoreDXI 진행 방식 문단을 포함한다", () => {
    const draft = buildCustomerEmailDraft(
      baseAnswers(),
      baseSummary(),
      { company: "테스트회사", name: "홍길동" }
    );
    expect(draft.body).toContain("진단(2주) → 설계 → 구축 → 교육");
  });

  it("수동 편집 슬롯([[ ]])을 포함한다", () => {
    const draft = buildCustomerEmailDraft(
      baseAnswers(),
      baseSummary(),
      { company: "테스트회사", name: "홍길동" }
    );
    expect(draft.body).toMatch(/\[\[.*\]\]/);
  });

  it("영업이사 서명 블록(catalog.ts SALES_SIGNATURE)을 포함한다", () => {
    const draft = buildCustomerEmailDraft(
      baseAnswers(),
      baseSummary(),
      { company: "테스트회사", name: "홍길동" }
    );
    expect(draft.body).toContain(SALES_SIGNATURE.name);
    expect(draft.body).toContain(SALES_SIGNATURE.phone);
  });

  it("업종(Q1) 라벨을 본문에 반영한다", () => {
    const draft = buildCustomerEmailDraft(
      baseAnswers({ q1: "av" }),
      baseSummary(),
      { company: "테스트회사", name: "홍길동" }
    );
    expect(draft.body).toContain("영상·음향(AV) 시스템 구축");
  });

  it("우선 과제 여러 개를 순서대로 번호 매겨 포함한다", () => {
    const draft = buildCustomerEmailDraft(
      baseAnswers(),
      baseSummary({
        priorities: [
          {
            title: "제안서·견적서 자동 초안 생성",
            why: "why1",
            echo: "echo1",
            industryExample: null,
            roadmap: ["step1a", "step1b", "step1c"],
            expectedEffect: "effect1",
          },
          {
            title: "입찰 공고 탐색·서류 자동화",
            why: "why2",
            echo: "echo2",
            industryExample: null,
            roadmap: ["step2a", "step2b", "step2c"],
            expectedEffect: "effect2",
          },
        ],
      }),
      { company: "테스트회사", name: "홍길동" }
    );
    expect(draft.body.indexOf("1. 제안서·견적서 자동 초안 생성")).toBeLessThan(
      draft.body.indexOf("2. 입찰 공고 탐색·서류 자동화")
    );
  });
});
