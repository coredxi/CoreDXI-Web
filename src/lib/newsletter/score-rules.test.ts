import { describe, expect, it } from "vitest";
import {
  computeRuleScore,
  credibilityFactor,
  recencyFactor,
  uniquenessFactor,
} from "./score-rules";

const NOW = new Date("2026-10-06T00:00:00Z");
const DAY = 86_400_000;

describe("recencyFactor", () => {
  it("오늘 기사 1.0, 수집기간 끝 0.2로 선형 감쇠", () => {
    expect(recencyFactor(NOW, NOW, 7)).toBe(1);
    expect(recencyFactor(new Date(NOW.getTime() - 7 * DAY), NOW, 7)).toBeCloseTo(0.2);
    expect(recencyFactor(new Date(NOW.getTime() - 3.5 * DAY), NOW, 7)).toBeCloseTo(0.6);
  });

  it("미래 날짜는 1.0, 기간 초과는 0.2로 고정", () => {
    expect(recencyFactor(new Date(NOW.getTime() + DAY), NOW, 7)).toBe(1);
    expect(recencyFactor(new Date(NOW.getTime() - 30 * DAY), NOW, 7)).toBeCloseTo(0.2);
  });

  it("collectDays가 0 이하여도 0으로 나누지 않는다", () => {
    expect(Number.isFinite(recencyFactor(new Date(NOW.getTime() - DAY), NOW, 0))).toBe(true);
  });
});

describe("credibilityFactor / uniquenessFactor", () => {
  it("미등록 매체 0.4, 등록 매체 trustWeight/5", () => {
    expect(credibilityFactor(null)).toBe(0.4);
    expect(credibilityFactor(5)).toBe(1);
    expect(credibilityFactor(9)).toBe(1);
  });

  it("단독 기사 0, 5개 매체 이상 전재 1", () => {
    expect(uniquenessFactor(1)).toBe(0);
    expect(uniquenessFactor(3)).toBe(0.5);
    expect(uniquenessFactor(10)).toBe(1);
  });
});

describe("computeRuleScore", () => {
  it("모든 요소 최대면 100", () => {
    expect(
      computeRuleScore({ hitRate: 1, publishedAt: NOW, now: NOW, collectDays: 7, trustWeight: 5, dupCount: 5 })
    ).toBe(100);
  });

  it("가중합을 반올림한 정수", () => {
    // 40*0.5 + 25*1 + 20*0.4 + 15*0 = 53
    expect(
      computeRuleScore({ hitRate: 0.5, publishedAt: NOW, now: NOW, collectDays: 7, trustWeight: null, dupCount: 1 })
    ).toBe(53);
  });

  it("범위를 벗어난 입력도 0~100으로 고정", () => {
    expect(
      computeRuleScore({ hitRate: 3, publishedAt: NOW, now: NOW, collectDays: 7, trustWeight: 5, dupCount: 99 })
    ).toBe(100);
  });
});
