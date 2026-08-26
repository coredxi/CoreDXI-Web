/**
 * ga4-events.ts — GA4 커스텀 이벤트 전송 유틸
 *
 * layout.tsx에 이미 로드된 gtag.js를 감싸서, 측정 ID가 설정되지 않았거나
 * 광고 차단기 등으로 gtag가 없을 때 조용히 무시한다(그레이스풀 디그레이드,
 * resend.ts의 getResendApiKey() ?? null 패턴과 동일한 원칙).
 */

type AnalyticsEventMap = {
  cta_click: { cta_location: string };
  contact_submit: Record<string, never>;
  newsletter_subscribe: { source: string };
  scroll_depth: { percent: 25 | 50 | 75 | 100 };
  // AX 체크(인터뷰 깔때기) 제출 — source는 ?ref= 코드(영업이사 식별), 2026-08-16 등록한
  // 기존 커스텀 디멘션(source)을 재사용한다. 설계: 2026-08-22-sales-funnel-ax-check-design.md 7번
  ax_check_submit: { source: string };
};

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackEvent<T extends keyof AnalyticsEventMap>(
  name: T,
  params: AnalyticsEventMap[T]
): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") {
    return;
  }
  window.gtag("event", name, params);
}
