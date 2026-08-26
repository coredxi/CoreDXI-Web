/**
 * get-funnel-metrics.ts — 전환 퍼널 대시보드 2단계 데이터 조회
 *
 * get-dashboard-metrics.ts와 동일한 BetaAnalyticsDataClient 인스턴스·에러 처리
 * 패턴(isGa4Configured(), ok/reason 유니언)을 재사용한다. 기존 함수는 건드리지
 * 않고 새 함수를 추가한다(회귀 리스크 최소화).
 *
 * 설계: docs/superpowers/specs/2026-08-14-funnel-dashboard-stage2-design.md 4-1
 */

import { BetaAnalyticsDataClient } from "@google-analytics/data";
import {
  getGa4PropertyId,
  getGa4ServiceAccountCredentials,
  isGa4Configured,
} from "./config";
import { buildFunnelStages } from "./funnel-calc";
import type { Ga4FunnelFetchResult, Ga4FunnelMetrics } from "./types";

// GA4 1단계(이벤트 태깅)에서 수집 중인 4종 커스텀 이벤트.
// 설계 3번 결정사항: 스크롤 깊이(percent) 세분화는 커스텀 디멘션 등록 확인 전까지
// 보류하고, 이벤트 총합(eventCount)만 사용한다.
const FUNNEL_EVENT_NAMES = [
  "scroll_depth",
  "cta_click",
  "contact_submit",
  "newsletter_subscribe",
] as const;

function createAnalyticsClient(): BetaAnalyticsDataClient | null {
  const credentials = getGa4ServiceAccountCredentials();
  if (!credentials) return null;

  return new BetaAnalyticsDataClient({ credentials });
}

function parseSessionsValue(
  rows: { metricValues?: { value?: string | null }[] | null }[] | null | undefined
): number {
  const value = rows?.[0]?.metricValues?.[0]?.value;
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseEventCounts(
  rows:
    | {
        dimensionValues?: { value?: string | null }[] | null;
        metricValues?: { value?: string | null }[] | null;
      }[]
    | null
    | undefined
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows ?? []) {
    const eventName = row.dimensionValues?.[0]?.value;
    const rawValue = row.metricValues?.[0]?.value;
    if (!eventName || !rawValue) continue;
    const parsed = Number(rawValue);
    counts[eventName] = Number.isFinite(parsed) ? parsed : 0;
  }
  return counts;
}

export async function getGa4FunnelMetrics(): Promise<Ga4FunnelFetchResult> {
  if (!isGa4Configured()) {
    return {
      ok: false,
      reason: "not_configured",
      message:
        "GA4_PROPERTY_ID와 GA4_SERVICE_ACCOUNT_JSON(또는 GA4_SERVICE_ACCOUNT_PATH) 환경 변수를 설정해 주세요. 서비스 계정 이메일을 GA4 속성 → 속성 액세스 관리에서 뷰어로 추가해야 합니다.",
    };
  }

  const propertyId = getGa4PropertyId();
  const client = createAnalyticsClient();
  if (!propertyId || !client) {
    return {
      ok: false,
      reason: "not_configured",
      message: "GA4 인증 정보를 읽을 수 없습니다. JSON 형식과 파일 경로를 확인해 주세요.",
    };
  }

  const property = `properties/${propertyId}`;
  const dateRanges = [{ startDate: "30daysAgo", endDate: "today" }];

  try {
    const [eventsReport, sessionsReport] = await Promise.all([
      client.runReport({
        property,
        dateRanges,
        dimensions: [{ name: "eventName" }],
        metrics: [{ name: "eventCount" }],
        dimensionFilter: {
          filter: {
            fieldName: "eventName",
            inListFilter: { values: [...FUNNEL_EVENT_NAMES] },
          },
        },
      }),
      client.runReport({
        property,
        dateRanges,
        metrics: [{ name: "sessions" }],
      }),
    ]);

    const eventCounts = parseEventCounts(eventsReport[0]?.rows);
    const sessions = parseSessionsValue(sessionsReport[0]?.rows);

    const data: Ga4FunnelMetrics = {
      stages: buildFunnelStages(sessions, eventCounts),
      newsletterSubscribeCount: eventCounts.newsletter_subscribe ?? 0,
      periodDays: 30,
      fetchedAt: new Date().toISOString(),
    };

    return { ok: true, data };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "GA4 퍼널 데이터를 불러오는 중 알 수 없는 오류가 발생했습니다.";

    return {
      ok: false,
      reason: "api_error",
      message,
    };
  }
}
