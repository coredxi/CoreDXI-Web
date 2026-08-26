import { listAxCheckResponses } from "@/actions/ax-check";
import { AdminLeadsManager } from "./AdminLeadsManager";

export const dynamic = "force-dynamic";

export default async function AdminLeadsPage() {
  const result = await listAxCheckResponses();

  return (
    <AdminLeadsManager
      initialLeads={result.success ? result.leads : []}
      loadError={result.success ? undefined : result.error}
    />
  );
}
