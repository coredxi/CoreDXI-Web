/**
 * Ga4AnalyticsPanel.tsx — 관리자 대시보드 GA4 연동 패널
 *
 * GA4 Data API(서비스 계정)로 방문자·인기 페이지 데이터를 불러와 표시합니다.
 * 환경 변수: GA4_PROPERTY_ID, GA4_SERVICE_ACCOUNT_JSON 또는 GA4_SERVICE_ACCOUNT_PATH
 */

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { formatKstDateTime } from "@/lib/format-kst-date";
import { getGa4DashboardMetrics } from "@/lib/ga4/get-dashboard-metrics";
import { Ga4FunnelPanel } from "./Ga4FunnelPanel";
import { Ga4StatsGrid } from "./Ga4StatsGrid";
import { Ga4TopPagesTable } from "./Ga4TopPagesTable";

export async function Ga4AnalyticsPanel() {
  const result = await getGa4DashboardMetrics();

  if (!result.ok) {
    const isApiDisabled = result.message.includes("analyticsdata.googleapis.com");
    const isNotConfigured = result.reason === "not_configured";

    return (
      <section
        className="rounded-xl border border-amber-200 bg-amber-50 p-6 shadow-sm"
        aria-labelledby="ga4-setup-heading"
      >
        <h2
          id="ga4-setup-heading"
          className="text-base font-semibold text-amber-950"
        >
          {isNotConfigured ? "GA4 연동 설정 필요" : "GA4 데이터를 불러올 수 없습니다"}
        </h2>
        <p className="mt-2 text-sm text-amber-900/90">{result.message}</p>
        {isApiDisabled ? (
          <ul className="mt-4 list-inside list-disc space-y-1 text-sm text-amber-900/80">
            <li>
              Google Cloud 프로젝트 <strong>coredxi-web</strong>에서{" "}
              <strong>Google Analytics Data API</strong>를 사용 설정하세요.
            </li>
            <li>
              <Link
                href="https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com?project=coredxi-web"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline underline-offset-2"
              >
                Analytics Data API 활성화 페이지 열기
              </Link>
            </li>
            <li>활성화 후 2~5분 기다린 뒤 대시보드를 새로고침하세요.</li>
            <li>
              GA4 → 관리 → 속성 액세스 관리에서{" "}
              <strong>coredxi@coredxi-web.iam.gserviceaccount.com</strong>을
              뷰어로 추가했는지도 확인하세요.
            </li>
          </ul>
        ) : isNotConfigured ? (
          <ul className="mt-4 list-inside list-disc space-y-1 text-sm text-amber-900/80">
            <li>
              {/* [홍보팀] GA4 속성 ID는 Analytics 관리 → 속성 설정에서 확인합니다. */}
              `.env`에 `GA4_PROPERTY_ID`(숫자 속성 ID)를 추가하세요.
            </li>
            <li>
              서비스 계정 JSON은 `GA4_SERVICE_ACCOUNT_JSON`(한 줄) 또는
              `GA4_SERVICE_ACCOUNT_PATH`(로컬 파일 경로)로 설정하세요.
            </li>
            <li>
              서비스 계정 이메일을 GA4 → 관리 → 속성 액세스 관리에서{" "}
              <strong>뷰어</strong> 권한으로 초대하세요.
            </li>
          </ul>
        ) : null}
      </section>
    );
  }

  const { data } = result;

  return (
    <section className="space-y-4" aria-labelledby="ga4-analytics-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="ga4-analytics-heading"
            className="text-lg font-semibold text-slate-900"
          >
            Google Analytics (GA4)
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {/* [홍보팀] 아래 수치는 GA4에서 자동으로 불러온 방문자 통계입니다. */}
            사이트 방문자 통계 · 마지막 갱신{" "}
            {formatKstDateTime(data.fetchedAt)}
          </p>
        </div>
        <Link
          href="https://analytics.google.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-primary shadow-sm transition-colors hover:bg-slate-50"
        >
          GA4 콘솔 열기
          <ExternalLink className="size-4" aria-hidden />
        </Link>
      </div>

      <Ga4StatsGrid summary={data.summary} />
      <Ga4TopPagesTable pages={data.topPages} />
      <Ga4FunnelPanel />
    </section>
  );
}
