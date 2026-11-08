import { describe, expect, it } from "vitest";
import { buildAutoIntro } from "./intro";
import type { KeywordInput } from "./types";

const kw = (term: string, operator: KeywordInput["operator"] = "OR"): KeywordInput => ({ group: 1, operator, term, weight: 3 });
const keywords = [kw("AI 에이전트"), kw("AX"), kw("생성형 AI"), kw("스마트공장"), kw("주가", "NOT")];

describe("buildAutoIntro", () => {
  it("선택 기사에 많이 나온 포함 키워드 최대 3개·건수·1위 기사 제목으로 세 문장을 만든다", () => {
    const intro = buildAutoIntro(
      [
        { title: "롯데면세점 AI 에이전트 구축, IT 아닌 현업이 주도", snippet: null },
        { title: "웹케시, 내부서 검증한 AX 고객으로 확장", snippet: "AI 에이전트 기반" },
        { title: "SK AX, 바이브 코딩 교육", snippet: "생성형 AI 활용" },
        { title: "일레븐랩스 보이스 AI 에이전트", snippet: null },
      ],
      keywords
    );
    expect(intro).toBe(
      "이번 주 AX 위클리는 AI 에이전트·AX·생성형 AI 관련 기사 4건을 골랐습니다. " +
        "가장 눈에 띈 소식은 \"롯데면세점 AI 에이전트 구축, IT 아닌 현업이 주도\"입니다. " +
        "각 기사 요약을 보시며 우리 회사에 바로 적용할 수 있는 부분을 찾아보세요."
    );
  });

  it("제외 키워드와 기사에 안 나온 키워드는 쓰지 않는다", () => {
    const intro = buildAutoIntro([{ title: "AX 전환 사례", snippet: "주가 급등" }], keywords);
    expect(intro).toContain("AX 관련 기사 1건");
    expect(intro).not.toContain("주가");
    expect(intro).not.toContain("스마트공장");
  });

  it("긴 제목은 40자에서 자르고 말줄임표를 붙인다", () => {
    const long = "가".repeat(45);
    expect(buildAutoIntro([{ title: long, snippet: null }], keywords)).toContain(`"${"가".repeat(40)}…"`);
  });

  it("매칭 키워드가 하나도 없으면 키워드 없이 건수만 말한다", () => {
    expect(buildAutoIntro([{ title: "무관한 기사", snippet: null }], keywords)).toMatch(/^이번 주 AX 위클리는 기사 1건을 골랐습니다\. /);
  });

  it("선택 기사가 없으면 null(인사말 비움)", () => {
    expect(buildAutoIntro([], keywords)).toBeNull();
  });
});
