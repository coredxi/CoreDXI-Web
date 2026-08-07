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
