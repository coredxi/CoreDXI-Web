import { listAxCheckResponses } from "@/actions/ax-check";
import { AdminLeadsManager } from "./AdminLeadsManager";

export const dynamic = "force-dynamic";

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string }>;
}) {
  const result = await listAxCheckResponses();
  const { lead } = await searchParams;

  return (
    <AdminLeadsManager
      initialLeads={result.success ? result.leads : []}
      loadError={result.success ? undefined : result.error}
      initialSelectedId={lead}
    />
  );
}
