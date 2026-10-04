// [홍보팀] 수집 기사 목록(최근 14일, 최대 200건) — 포스코 "자료 수집관리" 화면. "이번 호에 추가"로 후보에 직접 넣을 수 있습니다.
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireCampaignManager } from "@/lib/newsletter/admin-guard";
import { ensureCurrentIssue, type CampaignForIssue } from "@/lib/newsletter/issues";
import { formatKstDate } from "@/lib/format-kst-date";
import { AttachButton } from "./AttachButton";
import { ManualArticleForm } from "./ManualArticleForm";

export const dynamic = "force-dynamic";

export default async function CampaignArticlesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireCampaignManager(id);
  if (!gate.ok) return <p className="text-sm text-red-600">{gate.error}</p>;

  const campaign = await prisma.newsletterCampaign.findUnique({ where: { id } });
  if (!campaign) return <p className="text-sm text-red-600">캠페인을 찾을 수 없습니다.</p>;
  const issue = await ensureCurrentIssue(campaign as CampaignForIssue, new Date());
  const since = new Date(Date.now() - 14 * 86_400_000);
  const articles = await prisma.newsArticle.findMany({
    where: { collectedAt: { gte: since } },
    orderBy: { publishedAt: "desc" },
    take: 200,
    include: { source: true, issueArticles: { where: { issue: { campaignId: id } }, select: { issueId: true, ruleScore: true, isSelected: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{campaign.name} — 수집 기사</h1>
        {issue && (
          <Link href={`/admin/newsletter/campaigns/${id}/issues/${issue.id}`} className="text-sm text-[#1E4E8C] hover:underline">이번 호 편집 →</Link>
        )}
      </div>
      <ManualArticleForm campaignId={id} />
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
              <th className="px-4 py-3 font-medium">제목</th>
              <th className="px-4 py-3 font-medium">매체</th>
              <th className="px-4 py-3 font-medium">발행일</th>
              <th className="px-4 py-3 font-medium">규칙점수</th>
              <th className="px-4 py-3 font-medium">이번 호</th>
            </tr>
          </thead>
          <tbody>
            {articles.map((a) => {
              const inIssue = issue ? a.issueArticles.find((ia) => ia.issueId === issue.id) : undefined;
              const score = a.issueArticles[0]?.ruleScore;
              return (
                <tr key={a.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3">
                    <a href={a.originalUrl} target="_blank" rel="noopener noreferrer" className="text-gray-900 hover:underline">{a.title}</a>
                    {a.snippet && <p className="mt-1 line-clamp-1 text-xs text-gray-500">{a.snippet}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{a.source?.name ?? a.sourceName ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{formatKstDate(a.publishedAt)}</td>
                  <td className="px-4 py-3 text-gray-600">{score ?? "—"}</td>
                  <td className="px-4 py-3">
                    {inIssue ? <span className="text-xs text-[#1E4E8C]">{inIssue.isSelected ? "선택됨" : "후보"}</span>
                      : issue ? <AttachButton issueId={issue.id} articleId={a.id} /> : <span className="text-xs text-gray-400">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
