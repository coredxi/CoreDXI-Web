import { describe, expect, it } from "vitest";
import { buildCustomerEmailDraft, buildT0Email } from "./email-draft";
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
    expect(draft.subject).toBe("[CoreDXI] 테스트회사 AX 체크 결과 — 귀사의 우선 과제 1가지");
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

  it("영업이사 서명 블록 5줄(이름·직함/회사/연락처/태그라인/주소)을 포함한다", () => {
    const draft = buildCustomerEmailDraft(
      baseAnswers(),
      baseSummary(),
      { company: "테스트회사", name: "홍길동" }
    );
    expect(draft.body).toContain(`${SALES_SIGNATURE.name} ${SALES_SIGNATURE.title}`);
    expect(draft.body).toContain(SALES_SIGNATURE.company);
    expect(draft.body).toContain(`${SALES_SIGNATURE.phone} | ${SALES_SIGNATURE.email}`);
    expect(draft.body).toContain(SALES_SIGNATURE.tagline);
    expect(draft.body).toContain(SALES_SIGNATURE.addresses.join(" · "));
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

describe("buildCustomerEmailDraft — mode: auto", () => {
  it("수동 편집 슬롯([[ ]])이 없다", () => {
    const draft = buildCustomerEmailDraft(
      baseAnswers(),
      baseSummary(),
      { company: "테스트회사", name: "홍길동" },
      { mode: "auto" }
    );
    expect(draft.body).not.toMatch(/\[\[.*\]\]/);
  });

  it("T1 확정 제목 형식을 쓴다", () => {
    const draft = buildCustomerEmailDraft(
      baseAnswers(),
      baseSummary(),
      { company: "테스트회사", name: "홍길동" },
      { mode: "auto" }
    );
    expect(draft.subject).toBe(
      "[CoreDXI] 테스트회사 AX 체크 상세 진단 — 우선 과제 1가지와 3개월 로드맵"
    );
  });

  it("안 1의 여는 말·맺는 말로 교체된다", () => {
    const draft = buildCustomerEmailDraft(
      baseAnswers(),
      baseSummary(),
      { company: "테스트회사", name: "홍길동" },
      { mode: "auto" }
    );
    expect(draft.body).toContain("테스트회사 홍길동님, 안녕하세요. CoreDXI입니다.");
    expect(draft.body).toContain("도구를 소개하는 데서 끝나지 않고,");
    expect(draft.body).toContain("이 메일에 회신해 주시면 편하신 시간에 30분 통화로 테스트회사의 상황에 맞춰");
  });

  it("수신 거부 안내 문구를 포함한다", () => {
    const draft = buildCustomerEmailDraft(
      baseAnswers(),
      baseSummary(),
      { company: "테스트회사", name: "홍길동" },
      { mode: "auto" }
    );
    expect(draft.body).toContain("추가 안내를 원치 않으시면 이 메일에 회신으로");
  });
});

describe("buildCustomerEmailDraft — mode 미지정(기본값 manual)", () => {
  it("mode를 생략하면 기존 출력과 동일하다(플레이스홀더 포함)", () => {
    const draft = buildCustomerEmailDraft(baseAnswers(), baseSummary(), {
      company: "테스트회사",
      name: "홍길동",
    });
    expect(draft.body).toMatch(/\[\[.*\]\]/);
    expect(draft.subject).toBe("[CoreDXI] 테스트회사 AX 체크 결과 — 귀사의 우선 과제 1가지");
  });
});

describe("buildT0Email", () => {
  const links = { resultUrl: "https://www.coredxi.com/ax-check/result/tok123" };

  it("확정 제목 형식을 쓴다", () => {
    const draft = buildT0Email(baseSummary(), { company: "테스트회사", name: "홍길동" }, links);
    expect(draft.subject).toBe("[CoreDXI] 테스트회사 AX 체크 결과 — 우선 과제 1가지 정리본");
  });

  it("인사말과 우선 과제 번호 목록을 포함한다", () => {
    const draft = buildT0Email(baseSummary(), { company: "테스트회사", name: "홍길동" }, links);
    expect(draft.body).toContain("테스트회사 홍길동님, 안녕하세요. CoreDXI입니다.");
    expect(draft.body).toContain("  1. 제안서·견적서 자동 초안 생성");
  });

  it("결과 재열람 링크를 포함한다", () => {
    const draft = buildT0Email(baseSummary(), { company: "테스트회사", name: "홍길동" }, links);
    expect(draft.body).toContain("결과 다시 보기: https://www.coredxi.com/ax-check/result/tok123");
  });

  it("brochureUrl이 있으면 소개서 링크 줄을 포함한다", () => {
    const draft = buildT0Email(baseSummary(), { company: "테스트회사", name: "홍길동" }, {
      ...links,
      brochureUrl: "https://www.coredxi.com/solutions",
    });
    expect(draft.body).toContain(
      "CoreDXI AX 전환 컨설팅 소개서: https://www.coredxi.com/solutions"
    );
  });

  it("brochureUrl이 없으면 소개서 줄이 통째로 빠진다", () => {
    const draft = buildT0Email(baseSummary(), { company: "테스트회사", name: "홍길동" }, links);
    expect(draft.body).not.toContain("소개서");
  });

  it("서명 블록을 포함한다", () => {
    const draft = buildT0Email(baseSummary(), { company: "테스트회사", name: "홍길동" }, links);
    expect(draft.body).toContain(SALES_SIGNATURE.company);
  });
});

describe("html 버전 — 로고 포함 서명", () => {
  it("buildT0Email의 html에 로고 이미지와 서명 정보가 들어간다", () => {
    const draft = buildT0Email(
      baseSummary(),
      { company: "테스트회사", name: "홍길동" },
      { resultUrl: "https://www.coredxi.com/ax-check/result/tok123" }
    );
    expect(draft.html).toContain('<img src="https://www.coredxi.com/brand/email-logo.png"');
    expect(draft.html).toContain(SALES_SIGNATURE.company);
    expect(draft.html).toContain(SALES_SIGNATURE.phone);
  });

  it("buildCustomerEmailDraft(mode:auto)의 html에 로고 이미지와 본문 내용이 들어간다", () => {
    const draft = buildCustomerEmailDraft(
      baseAnswers(),
      baseSummary(),
      { company: "테스트회사", name: "홍길동" },
      { mode: "auto" }
    );
    expect(draft.html).toContain('<img src="https://www.coredxi.com/brand/email-logo.png"');
    expect(draft.html).toContain("제안서·견적서 자동 초안 생성");
    expect(draft.html).toContain(SALES_SIGNATURE.company);
  });

  it("html은 본문에 있는 특수문자를 이스케이프한다", () => {
    const draft = buildT0Email(
      baseSummary(),
      { company: "A&B<테스트>", name: "홍길동" },
      { resultUrl: "https://www.coredxi.com/ax-check/result/tok123" }
    );
    expect(draft.html).toContain("A&amp;B&lt;테스트&gt;");
    expect(draft.html).not.toContain("A&B<테스트>");
  });
});
