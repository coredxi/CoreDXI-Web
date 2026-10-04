/**
 * score-rules.ts — 1차 규칙 기반 선별 점수(0~100). 순수 함수.
 * [홍보팀] 키워드 적중 40점 + 최신성 25점 + 매체 신뢰도 20점 + "여러 매체가 다룬 큰 뉴스" 15점.
 * 비율을 바꾸려면 RULE_WEIGHTS만 수정하면 됩니다(합계 100 유지).
 * 설계: docs/superpowers/specs/2026-09-28-newsletter-distribution-design.md 6-2
 */

export const RULE_WEIGHTS = { keyword: 40, recency: 25, credibility: 20, uniqueness: 15 } as const;

const DAY_MS = 86_400_000;

export type RuleScoreInput = {
  hitRate: number;
  publishedAt: Date;
  now: Date;
  collectDays: number;
  trustWeight: number | null;
  dupCount: number;
};

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export function recencyFactor(publishedAt: Date, now: Date, collectDays: number): number {
  const days = (now.getTime() - publishedAt.getTime()) / DAY_MS;
  if (days <= 0) return 1;
  const span = Math.max(1, collectDays);
  return 1 - (0.8 * Math.min(days, span)) / span;
}

export function credibilityFactor(trustWeight: number | null): number {
  if (trustWeight == null) return 0.4;
  return Math.min(5, Math.max(1, trustWeight)) / 5;
}

export function uniquenessFactor(dupCount: number): number {
  return clamp01(Math.max(0, dupCount - 1) / 4);
}

export function computeRuleScore(input: RuleScoreInput): number {
  const raw =
    RULE_WEIGHTS.keyword * clamp01(input.hitRate) +
    RULE_WEIGHTS.recency * recencyFactor(input.publishedAt, input.now, input.collectDays) +
    RULE_WEIGHTS.credibility * credibilityFactor(input.trustWeight) +
    RULE_WEIGHTS.uniqueness * uniquenessFactor(input.dupCount);
  return Math.max(0, Math.min(100, Math.round(raw)));
}
