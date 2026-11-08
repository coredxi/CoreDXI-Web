// [홍보팀] 새 뉴스레터 캠페인 만들기 화면.
import { listNewsSources } from "@/actions/newsletter-campaigns";
import { CampaignForm } from "../CampaignForm";

export const dynamic = "force-dynamic";

export default async function NewCampaignPage() {
  const result = await listNewsSources();
  if (!result.success) return <p className="text-sm text-red-600">{result.error}</p>;
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">새 캠페인 만들기</h1>
      <CampaignForm sources={result.sources} />
    </div>
  );
}
