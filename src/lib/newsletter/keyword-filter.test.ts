import { describe, expect, it } from "vitest";
import { keywordHitRate, matchKeywords, pickQueryTerms } from "./keyword-filter";
import type { KeywordInput } from "./types";

const KW: KeywordInput[] = [
  { group: 1, operator: "OR", term: "AI 도입", weight: 5 },
  { group: 1, operator: "OR", term: "AX", weight: 4 },
  { group: 2, operator: "OR", term: "중소기업", weight: 5 },
  { group: 2, operator: "OR", term: "제조", weight: 2 },
  { group: 2, operator: "OR", term: "SI", weight: 2 },
  { group: 0, operator: "NOT", term: "주가", weight: 1 },
];

describe("matchKeywords", () => {
  it("모든 그룹에서 하나 이상 적중하면 통과(그룹 간 AND)", () => {
    expect(matchKeywords(KW, "중소기업 AI 도입 가속", "").passes).toBe(true);
  });

  it("한 그룹이라도 적중이 없으면 탈락", () => {
    expect(matchKeywords(KW, "대기업 AI 도입", "").passes).toBe(false);
  });

  it("제외어가 제목이나 요약에 있으면 탈락", () => {
    expect(matchKeywords(KW, "중소기업 AI 도입", "관련주 주가 급등").passes).toBe(false);
  });

  it("대소문자·연속 공백을 무시한다", () => {
    expect(matchKeywords(KW, "중소기업  ai   도입", "").passes).toBe(true);
  });

  it("포함 키워드가 하나도 없으면 아무것도 통과하지 않는다", () => {
    const onlyNot: KeywordInput[] = [{ group: 0, operator: "NOT", term: "주가", weight: 1 }];
    expect(matchKeywords(onlyNot, "아무 기사", "").passes).toBe(false);
  });

  it("빈 문자열 키워드는 무시한다(모든 기사에 적중하는 사고 방지)", () => {
    const withBlank: KeywordInput[] = [{ group: 1, operator: "OR", term: "  ", weight: 5 }];
    expect(matchKeywords(withBlank, "아무 기사", "").passes).toBe(false);
  });
});

describe("keywordHitRate", () => {
  it("제목 적중(×2)은 요약 적중(×1)보다 높다", () => {
    const inTitle = keywordHitRate(matchKeywords(KW, "중소기업 AI 도입", ""));
    const inSnippet = keywordHitRate(matchKeywords(KW, "기사", "중소기업 AI 도입"));
    expect(inTitle).toBe(1);
    expect(inSnippet).toBe(0.5);
  });

  it("가중치가 낮은 키워드로만 적중하면 적중률이 낮다", () => {
    const rate = keywordHitRate(matchKeywords(KW, "제조 AX", ""));
    // 그룹1 best=4*2=8/max10, 그룹2 best=2*2=4/max10 → 12/20
    expect(rate).toBeCloseTo(0.6);
  });

  it("탈락 기사는 0", () => {
    expect(keywordHitRate(matchKeywords(KW, "무관", ""))).toBe(0);
  });
});

describe("pickQueryTerms", () => {
  it("용어 수가 가장 적은 포함 그룹의 용어만 질의한다(AND 결과는 반드시 이 그룹 용어를 포함)", () => {
    expect(pickQueryTerms(KW)).toEqual(["AI 도입", "AX"]);
  });

  it("포함 그룹이 없으면 빈 배열", () => {
    expect(pickQueryTerms([{ group: 0, operator: "NOT", term: "주가", weight: 1 }])).toEqual([]);
  });

  it("중복·공백 용어를 정리한다", () => {
    const kw: KeywordInput[] = [
      { group: 1, operator: "OR", term: " AI ", weight: 1 },
      { group: 1, operator: "OR", term: "AI", weight: 1 },
    ];
    expect(pickQueryTerms(kw)).toEqual(["AI"]);
  });
});
