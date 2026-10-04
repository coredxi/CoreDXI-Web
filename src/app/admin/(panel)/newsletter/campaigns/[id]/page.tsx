// [홍보팀] 캠페인 상세 — 최근 호 바로가기, 수집 기사 보기, 설정 수정을 한 화면에서 합니다.
import Link from "next/link";
import { getCampaignForEdit, listNewsSources } from "@/actions/newsletter-campaigns";
import { formatKstDate } from "@/lib/format-kst-date";
import { formatKstYmd } from "@/lib/newsletter/schedule";
import type { CampaignFormInput } from "@/lib/newsletter/campaign-input";
import { CampaignForm } from "../CampaignForm";
import { CampaignActions } from "./CampaignActions";

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [result, sourcesResult] = await Promise.all([getCampaignForEdit(id), listNewsSources()]);
  if (!result.success) return <p className="text-sm text-red-600">{result.error}</p>;
  if (!sourcesResult.success) return <p className="text-sm text-red-600">{sourcesResult.error}</p>;
  const c = result.campaign;

  const initial: CampaignFormInput = {
    id: c.id,
    name: c.name,
    subjectTemplate: c.subjectTemplate,
    sendType: c.sendType,
    cadence: c.cadence,
    sendDayOfWeek: c.sendDayOfWeek,
    sendHourKst: c.sendHourKst,
    activeFrom: formatKstYmd(c.activeFrom),
    activeUntil: c.activeUntil ? formatKstYmd(c.activeUntil) : null,
    collectDays: c.collectDays,
    maxArticles: c.maxArticles,
    audience: c.audience === "internal" ? "internal" : "subscribers",
    internalRecipients: c.internalRecipients,
    keywords: c.keywords.map((k) => ({ group: k.group, operator: k.operator, term: k.term, weight: k.weight })),
    rules: c.rules.map((r) => ({ indicator: r.indicator, label: r.label, description: r.description, weight: r.weight, isEnabled: r.isEnabled })),
    sourceIds: c.sources.map((s) => s.sourceId),
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">{c.name}</h1>
        <CampaignActions id={c.id} isActive={c.isActive} isDraft={c.isDraft} />
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">최근 호</h2>
          <Link href={`/admin/newsletter/campaigns/${c.id}/articles`} className="text-sm text-[#1E4E8C] hover:underline">수집 기사 보기 →</Link>
        </div>
        <ul className="mt-3 space-y-2 text-sm">
          {c.issues.length === 0 ? <li className="text-gray-500">아직 호가 없습니다. &quot;지금 수집&quot;을 눌러 보세요.</li> : c.issues.map((i) => (
            <li key={i.id}>
              <Link href={`/admin/newsletter/campaigns/${c.id}/issues/${i.id}`} className="text-[#1E4E8C] hover:underline">
                #{i.issueNo} · {formatKstDate(i.issueDate)} · {i.subject}
              </Link>
              <span className="ml-2 text-xs text-gray-500">{i.status}</span>
            </li>
          ))}
        </ul>
      </section>

      <CampaignForm sources={sourcesResult.sources} initial={initial} isDraft={c.isDraft} />
    </div>
  );
}
