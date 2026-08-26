import { describe, expect, it } from "vitest";
import { buildFunnelStages } from "./funnel-calc";

describe("buildFunnelStages", () => {
  it("계산: count/sessions*100을 소수 1자리로 반환한다", () => {
    const stages = buildFunnelStages(1000, {
      scroll_depth: 400,
      cta_click: 150,
      contact_submit: 20,
    });

    expect(stages).toEqual([
      { key: "sessions", label: "전체 방문(세션)", count: 1000, conversionRate: 100 },
      { key: "scroll_depth", label: "스크롤 참여", count: 400, conversionRate: 40 },
      { key: "cta_click", label: "CTA 클릭", count: 150, conversionRate: 15 },
      { key: "contact_submit", label: "문의 제출", count: 20, conversionRate: 2 },
    ]);
  });

  it("소수 1자리로 반올림한다", () => {
    const stages = buildFunnelStages(3, { scroll_depth: 1, cta_click: 0, contact_submit: 0 });
    const scrollStage = stages.find((s) => s.key === "scroll_depth");
    // 1/3*100 = 33.333... -> 33.3
    expect(scrollStage?.conversionRate).toBeCloseTo(33.3, 5);
  });

  it("sessions가 0이면 0으로 나누지 않고 conversionRate 0을 반환한다", () => {
    const stages = buildFunnelStages(0, {
      scroll_depth: 5,
      cta_click: 2,
      contact_submit: 1,
    });

    for (const stage of stages) {
      expect(stage.conversionRate).toBe(0);
      expect(Number.isFinite(stage.conversionRate)).toBe(true);
    }
  });

  it("이벤트 카운트가 누락되면 0건으로 처리한다", () => {
    const stages = buildFunnelStages(500, {});

    expect(stages.find((s) => s.key === "scroll_depth")).toMatchObject({
      count: 0,
      conversionRate: 0,
    });
    expect(stages.find((s) => s.key === "cta_click")).toMatchObject({
      count: 0,
      conversionRate: 0,
    });
    expect(stages.find((s) => s.key === "contact_submit")).toMatchObject({
      count: 0,
      conversionRate: 0,
    });
  });

  it("sessions 단계는 항상 count=sessions, conversionRate=100(0 제외)이다", () => {
    const stages = buildFunnelStages(200, {});
    const sessionsStage = stages.find((s) => s.key === "sessions");
    expect(sessionsStage).toMatchObject({ count: 200, conversionRate: 100 });
  });
});
