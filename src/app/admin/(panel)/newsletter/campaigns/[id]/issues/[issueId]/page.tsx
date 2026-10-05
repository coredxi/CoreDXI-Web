// [홍보팀] 뉴스레터 한 호 편집 화면 — 제목·인사말·기사 선택을 고치고 미리보기·검토요청·승인·발송합니다.
import { getIssueForEdit } from "@/actions/newsletter-issues";
import { formatKstDate, formatKstDateTime } from "@/lib/format-kst-date";
import { IssueEditor } from "./IssueEditor";
import { sendNowConfirmMessage } from "@/lib/newsletter/audience";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 즉시 발송(최대 80통 × 600ms 스로틀)

export default async function IssuePage({ params }: { params: Promise<{ id: string; issueId: string }> }) {
  const { issueId } = await params;
  const result = await getIssueForEdit(issueId);
  if (!result.success) return <p className="text-sm text-red-600">{result.error}</p>;
  const issue = result.issue;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">{issue.campaign.name} #{issue.issueNo}</h1>
      <p className="mb-6 mt-1 text-sm text-gray-500">발행일 {formatKstDate(issue.issueDate)} · 상태 {issue.status}{issue.lastError ? ` · ${issue.lastError}` : ""}</p>
      <IssueEditor
        issueId={issue.id}
        status={issue.status}
        subject={issue.subject}
        intro={issue.intro}
        maxArticles={issue.campaign.maxArticles}
        sendNowConfirm={sendNowConfirmMessage(issue.campaign.audience, issue.campaign.internalRecipients.length)}
        scheduledLabel={issue.scheduledAt ? formatKstDateTime(issue.scheduledAt) : null}
        articles={issue.articles.map((ia) => ({
          id: ia.id,
          isSelected: ia.isSelected,
          sortOrder: ia.sortOrder,
          editorNote: ia.editorNote,
          summary: ia.summary,
          title: ia.article.title,
          url: ia.article.originalUrl,
          sourceName: ia.article.source?.name ?? ia.article.sourceName,
          publishedLabel: formatKstDate(ia.article.publishedAt),
          ruleScore: ia.ruleScore,
        }))}
      />
    </div>
  );
}
