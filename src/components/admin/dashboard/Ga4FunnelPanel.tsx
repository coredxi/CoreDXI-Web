/**
 * Ga4FunnelPanel.tsx — 전환 퍼널 분석 대시보드 2단계(시각화 UI)
 *
 * GA4 Data API로 최근 30일 이벤트 카운트 기반 근사 퍼널을 조회해 가로 바 형태로
 * 표시합니다. 신규 차트 라이브러리 의존성을 피하기 위해 커스텀 CSS로 구현합니다.
 * 설계: docs/superpowers/specs/2026-08-14-funnel-dashboard-stage2-design.md 4-4
 */

import { ClipboardCheck, Mail } from "lucide-react";
import { getGa4FunnelMetrics } from "@/lib/ga4/get-funnel-metrics";

export async function Ga4FunnelPanel() {
  const result = await getGa4FunnelMetrics();

  // GA4 미설정/오류 시에는 Ga4AnalyticsPanel의 기존 안내 배너가 이미 표시되므로
  // 별도 에러 UI를 신설하지 않고 조용히 렌더링을 생략한다.
  if (!result.ok) {
    return null;
  }

  const { data } = result;
  const maxCount = data.stages[0]?.count ?? 0;

  return (
    <section
      className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm"
      aria-labelledby="ga4-funnel-heading"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="ga4-funnel-heading" className="text-base font-semibold text-slate-900">
            전환 퍼널 (최근 {data.periodDays}일, 근사치)
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {/* [홍보팀] 방문부터 문의까지 각 단계에서 이벤트가 얼마나 발생했는지 보여주는 지표입니다. */}
            eventCount 기반 · scroll_depth / cta_click / contact_submit
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
            <Mail className="size-4 text-[#1E4E8C]" aria-hidden />
            <div className="text-xs">
              <p className="font-medium text-slate-900">
                뉴스레터 구독 {data.newsletterSubscribeCount.toLocaleString("ko-KR")}건
              </p>
              <p className="text-slate-400">퍼널 단계 아님 · 별도 지표</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
            <ClipboardCheck className="size-4 text-[#1E4E8C]" aria-hidden />
            <div className="text-xs">
              <p className="font-medium text-slate-900">
                AX 체크 제출 {data.axCheckSubmitCount.toLocaleString("ko-KR")}건
              </p>
              <p className="text-slate-400">퍼널 단계 아님 · 별도 지표</p>
            </div>
          </div>
        </div>
      </div>

      <ul className="mt-5 space-y-3">
        {data.stages.map((stage) => {
          const widthPercent =
            maxCount > 0 ? Math.max((stage.count / maxCount) * 100, stage.count > 0 ? 2 : 0) : 0;

          return (
            <li key={stage.key}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium text-slate-700">{stage.label}</span>
                <span className="text-slate-500">
                  {stage.count.toLocaleString("ko-KR")}건 · 전체 방문 대비{" "}
                  {stage.conversionRate.toLocaleString("ko-KR")}%
                </span>
              </div>
              <div className="mt-1.5 h-3 w-full overflow-hidden rounded-xl bg-slate-100">
                <div
                  className="h-full rounded-xl bg-[#1E4E8C]"
                  style={{ width: `${widthPercent}%`, opacity: 0.4 + (stage.conversionRate / 100) * 0.6 }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-xs text-slate-400">
        ※ 방문 대비 이벤트 발생 비율 기반 근사치이며, 개별 사용자의 단계별 이동을 추적한 것은
        아닙니다.
      </p>
    </section>
  );
}
