import { describe, expect, it } from "vitest";
import { validateCampaignInput, type CampaignFormInput } from "./campaign-input";

const valid: CampaignFormInput = {
  name: " AX 위클리 ",
  subjectTemplate: "(광고) [AX 위클리] {{issueDate}}",
  sendType: "REVIEW_THEN_SEND",
  cadence: "WEEKLY",
  sendDayOfWeek: 2,
  sendHourKst: 8,
  activeFrom: "2026-10-06",
  activeUntil: "2026-12-31",
  collectDays: 7,
  maxArticles: 7,
  audience: "subscribers",
  internalRecipients: [],
  keywords: [
    { group: 1, operator: "OR", term: " AI 도입 ", weight: 5 },
    { group: 1, operator: "OR", term: "", weight: 3 },
  ],
  rules: [{ indicator: "relevance", label: "관련성", description: "d", weight: 3, isEnabled: true }],
  sourceIds: ["s1", "s1"],
};

describe("validateCampaignInput", () => {
  it("정상 입력을 정규화한다(공백·빈 키워드·중복 매체 제거, KST 날짜 변환)", () => {
    const r = validateCampaignInput(valid, { draft: false });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.name).toBe("AX 위클리");
    expect(r.data.keywords).toEqual([{ group: 1, operator: "OR", term: "AI 도입", weight: 5 }]);
    expect(r.data.sourceIds).toEqual(["s1"]);
    expect(r.data.activeFrom.toISOString()).toBe("2026-10-05T15:00:00.000Z");
    expect(r.data.activeUntil?.toISOString()).toBe("2026-12-31T14:59:59.999Z");
  });

  it("임시저장은 이름만 있으면 통과", () => {
    const r = validateCampaignInput({ ...valid, keywords: [], subjectTemplate: "" }, { draft: true });
    expect(r.ok).toBe(true);
  });

  it.each([
    [{ name: "  " }, "이름"],
    [{ keywords: [] }, "포함 키워드"],
    [{ sendType: "SCHEDULED" as const }, "2단계"],
    [{ sendHourKst: 24 }, "발송 시각"],
    [{ collectDays: 0 }, "수집기간"],
    [{ maxArticles: 21 }, "기사 수"],
    [{ sendDayOfWeek: null }, "요일"],
    [{ activeUntil: "2026-10-01" }, "사용기간"],
    [{ activeFrom: "2026-02-30" }, "사용기간"],
    [{ audience: "internal" as const, internalRecipients: ["bad"] }, "내부 수신자"],
    [{ subjectTemplate: "" }, "제목"],
  ])("잘못된 입력 거부: %o", (patch, keyword) => {
    const r = validateCampaignInput({ ...valid, ...patch }, { draft: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(keyword);
  });

  it("DAILY는 요일이 없어도 된다", () => {
    expect(validateCampaignInput({ ...valid, cadence: "DAILY", sendDayOfWeek: null }, { draft: false }).ok).toBe(true);
  });
});
