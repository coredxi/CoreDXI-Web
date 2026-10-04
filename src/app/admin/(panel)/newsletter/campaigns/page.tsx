// [홍보팀] 뉴스레터 캠페인(기준) 목록 — 이름·주기·최근 호 상태를 한눈에 봅니다. 포스코 "뉴스레터 기준관리" 화면에 해당.
import Link from "next/link";
import { listCampaigns } from "@/actions/newsletter-campaigns";
import { buttonVariants } from "@/components/ui/button";
import { formatKstDate } from "@/lib/format-kst-date";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const CADENCE_LABEL: Record<string, string> = { DAILY: "매일", WEEKLY: "매주", BIWEEKLY: "격주", MONTHLY: "매월" };
const DAY_LABEL = ["일", "월", "화", "수", "목", "금", "토"];
const STATUS_LABEL: Record<string, string> = {
  COLLECTING: "수집 중", DRAFT: "초안", REVIEW_REQUESTED: "검토 요청", APPROVED: "승인(예약)",
  SENDING: "발송 중", SENT: "발송 완료", FAILED: "실패", CANCELED: "취소",
};

export default async function NewsletterCampaignsPage() {
  const result = await listCampaigns();
  if (!result.success) return <p className="text-sm text-red-600">{result.error}</p>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">뉴스레터 캠페인</h1>
        <Link href="/admin/newsletter/campaigns/new" className={cn(buttonVariants({ variant: "default", size: "default" }))}>
          새 캠페인 만들기
        </Link>
      </div>
      <div className="mt-6 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
              <th className="px-4 py-3 font-medium">이름</th>
              <th className="px-4 py-3 font-medium">주기</th>
              <th className="px-4 py-3 font-medium">최근 호</th>
              <th className="px-4 py-3 font-medium">상태</th>
            </tr>
          </thead>
          <tbody>
            {result.campaigns.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">아직 캠페인이 없습니다.</td></tr>
            ) : (
              result.campaigns.map((c) => {
                const latest = c.issues[0];
                return (
                  <tr key={c.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/admin/newsletter/campaigns/${c.id}`} className="font-medium text-[#1E4E8C] hover:underline">
                        {c.name}
                      </Link>
                      {c.isDraft && <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">임시저장</span>}
                      {!c.isActive && <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">미사용</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {CADENCE_LABEL[c.cadence]} {c.cadence !== "DAILY" && c.sendDayOfWeek !== null ? `${DAY_LABEL[c.sendDayOfWeek]}요일 ` : ""}
                      {c.sendHourKst}시
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {latest ? `#${latest.issueNo} · ${formatKstDate(latest.issueDate)}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{latest ? STATUS_LABEL[latest.status] : "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
