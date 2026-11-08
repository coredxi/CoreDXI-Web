import { listAxCheckResponses } from "@/actions/ax-check";
import { auth } from "@/auth";
import { previewTestData } from "@/actions/test-data-cleanup";
import { AdminLeadsManager } from "./AdminLeadsManager";

export const dynamic = "force-dynamic";

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string }>;
}) {
  const session = await auth();
  // [홍보팀] "테스트 데이터 정리" 버튼은 최고 관리자(SUPER_ADMIN)에게만 보입니다.
  const canCleanup = session?.user?.role === "SUPER_ADMIN";
  const [result, cleanupResult] = await Promise.all([
    listAxCheckResponses(),
    canCleanup ? previewTestData("leads") : Promise.resolve(null),
  ]);
  const { lead } = await searchParams;

  return (
    <AdminLeadsManager
      initialLeads={result.success ? result.leads : []}
      loadError={result.success ? undefined : result.error}
      initialSelectedId={lead}
      cleanupPreview={cleanupResult?.success ? cleanupResult.preview : null}
    />
  );
}
