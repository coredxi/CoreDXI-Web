import { formatKstDate } from "@/lib/format-kst-date";
import type { AxCheckLeadRecord } from "@/lib/ax-check/types";
import { LEAD_STATUS_OPTIONS } from "@/lib/ax-check/types";
import { LeadGradeBadge } from "./LeadGradeBadge";

const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  LEAD_STATUS_OPTIONS.map((o) => [o.value, o.label])
);

type Props = {
  leads: AxCheckLeadRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function LeadList({ leads, selectedId, onSelect }: Props) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-bold text-slate-900">AX 체크 리드 목록</h2>
      </div>
      {leads.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-slate-500">
          아직 접수된 AX 체크 응답이 없습니다.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">등급</th>
                <th className="px-4 py-3">회사</th>
                <th className="px-4 py-3">담당자</th>
                <th className="px-4 py-3">ref</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3">제출일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leads.map((lead) => {
                const isSelected = lead.id === selectedId;
                return (
                  <tr
                    key={lead.id}
                    onClick={() => onSelect(lead.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? "bg-indigo-50/80" : "hover:bg-slate-50/80"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <LeadGradeBadge grade={lead.grade} />
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{lead.company}</td>
                    <td className="px-4 py-3 text-slate-600">{lead.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {lead.refCode ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {STATUS_LABEL[lead.status] ?? lead.status}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {formatKstDate(lead.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
