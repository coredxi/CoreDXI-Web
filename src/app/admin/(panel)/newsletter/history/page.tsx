// [홍보팀] 뉴스레터 발송 이력 — 호별 수신 인원·실패 건수를 보고, 실패한 호는 재시도합니다.
import Link from "next/link";
import { listIssueHistory } from "@/actions/newsletter-issues";
import { formatKstDate } from "@/lib/format-kst-date";
import { RetryButton } from "./RetryButton";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function NewsletterHistoryPage() {
  const result = await listIssueHistory();
  if (!result.success) return <p className="text-sm text-red-600">{result.error}</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">발송 이력</h1>
      <div className="mt-6 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
              <th className="px-4 py-3 font-medium">캠페인 · 회차</th>
              <th className="px-4 py-3 font-medium">상태</th>
              <th className="px-4 py-3 font-medium">예약/발송</th>
              <th className="px-4 py-3 font-medium">성공 / 전체</th>
              <th className="px-4 py-3 font-medium">실패</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {result.issues.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">아직 승인·발송된 호가 없습니다.</td></tr>
            ) : result.issues.map((i) => (
              <tr key={i.id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-3">
                  <Link href={`/admin/newsletter/campaigns/${i.campaign.id}/issues/${i.id}`} className="text-[#1E4E8C] hover:underline">
                    {i.campaign.name} #{i.issueNo}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">{i.status}{i.lastError ? ` — ${i.lastError}` : ""}</td>
                <td className="px-4 py-3 text-gray-600">{formatKstDate(i.sentAt ?? i.scheduledAt ?? i.issueDate)}</td>
                <td className="px-4 py-3 text-gray-600">{i.recipientCount} / {i._count.deliveries}</td>
                <td className="px-4 py-3 text-gray-600">{i.deliveries.length}</td>
                <td className="px-4 py-3">{i.status === "FAILED" && <RetryButton issueId={i.id} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
