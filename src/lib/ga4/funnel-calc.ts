/**
 * funnel-calc.ts — 전환 퍼널 단계 계산 (순수 함수)
 *
 * GA4 API 응답 파싱과 계산 로직을 분리해 DOM/네트워크 의존 없이 테스트 가능하게 한다.
 * 설계: docs/superpowers/specs/2026-08-14-funnel-dashboard-stage2-design.md 4-3
 */

import type { Ga4FunnelStage } from "./types";

const STAGE_DEFS: readonly { key: Ga4FunnelStage["key"]; label: string }[] = [
  { key: "sessions", label: "전체 방문(세션)" },
  { key: "scroll_depth", label: "스크롤 참여" },
  { key: "cta_click", label: "CTA 클릭" },
  { key: "contact_submit", label: "문의 제출" },
];

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * eventName → eventCount 맵과 sessions 총계로 퍼널 단계를 계산한다.
 * sessions가 0이면 0으로 나누지 않고 conversionRate를 0으로 반환한다.
 */
export function buildFunnelStages(
  sessions: number,
  eventCounts: Record<string, number>
): Ga4FunnelStage[] {
  return STAGE_DEFS.map(({ key, label }) => {
    const count = key === "sessions" ? sessions : (eventCounts[key] ?? 0);
    const conversionRate = sessions > 0 ? round1((count / sessions) * 100) : 0;
    return { key, label, count, conversionRate };
  });
}
