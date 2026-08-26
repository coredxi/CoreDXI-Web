export type Ga4SummaryMetrics = {
  activeUsersToday: number;
  activeUsers7Days: number;
  sessions7Days: number;
  pageViews7Days: number;
  newUsers7Days: number;
};

export type Ga4TopPage = {
  path: string;
  pageViews: number;
};

export type Ga4DashboardMetrics = {
  summary: Ga4SummaryMetrics;
  topPages: Ga4TopPage[];
  fetchedAt: string;
};

export type Ga4FetchResult =
  | { ok: true; data: Ga4DashboardMetrics }
  | { ok: false; reason: "not_configured" | "api_error"; message: string };

// 전환 퍼널 대시보드 2단계(시각화 UI) — 이벤트 카운트 기반 근사 퍼널.
// 설계: docs/superpowers/specs/2026-08-14-funnel-dashboard-stage2-design.md 4-2
export type Ga4FunnelStage = {
  key: "sessions" | "scroll_depth" | "cta_click" | "contact_submit";
  label: string;
  count: number;
  conversionRate: number; // count / sessions * 100, 소수 1자리
};

export type Ga4FunnelMetrics = {
  stages: Ga4FunnelStage[];
  newsletterSubscribeCount: number; // 퍼널과 별개 지표(카드 1개로 병기)
  periodDays: 30;
  fetchedAt: string;
};

export type Ga4FunnelFetchResult =
  | { ok: true; data: Ga4FunnelMetrics }
  | { ok: false; reason: "not_configured" | "api_error"; message: string };
