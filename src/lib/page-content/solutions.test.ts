import { describe, expect, it } from "vitest";
import { SOLUTIONS_CONTENT_DEFAULTS } from "./solutions";

const FORBIDDEN_PHRASE = "AI로 위험성평가표를 만들어";
const PERSONAL_TITLES = ["이사", "대표", "부장"];

describe("SOLUTIONS_CONTENT_DEFAULTS.caseStudy* — 금지 표현·화자 회귀 테스트", () => {
  const allCaseStudyText = [
    SOLUTIONS_CONTENT_DEFAULTS.caseStudyEyebrow,
    SOLUTIONS_CONTENT_DEFAULTS.caseStudyTitle,
    ...SOLUTIONS_CONTENT_DEFAULTS.caseStudyParagraphs,
    SOLUTIONS_CONTENT_DEFAULTS.caseStudyPdfLabel,
    SOLUTIONS_CONTENT_DEFAULTS.caseStudyDemoLabel,
  ].join("\n");

  it("정부 KRAS 무료 제공 문구와 겹치는 금지 표현을 포함하지 않는다", () => {
    expect(allCaseStudyText).not.toContain(FORBIDDEN_PHRASE);
  });

  it("화자는 코어디엑스아이이고 개인 직함을 쓰지 않는다", () => {
    expect(allCaseStudyText).toContain("코어디엑스아이");
    for (const title of PERSONAL_TITLES) {
      expect(allCaseStudyText).not.toContain(title);
    }
  });

  it("법령 수치(시행일·과태료)를 인용하지 않는다", () => {
    expect(allCaseStudyText).not.toMatch(/과태료/);
    expect(allCaseStudyText).not.toMatch(/\d+천만\s*원/);
  });
});
