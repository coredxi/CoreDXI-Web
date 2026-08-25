"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import {
  deleteAxCheckResponse,
  updateAxCheckNote,
  updateAxCheckStatus,
} from "@/actions/ax-check";
import type { AxCheckLeadRecord, LeadStatus } from "@/lib/ax-check/types";
import { LEAD_STATUS_OPTIONS } from "@/lib/ax-check/types";
import { formatKstDateTime } from "@/lib/format-kst-date";
import { LeadList } from "./LeadList";
import { LeadDetailPanel } from "./LeadDetailPanel";

const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  LEAD_STATUS_OPTIONS.map((o) => [o.value, o.label])
);

type Props = {
  initialLeads: AxCheckLeadRecord[];
  loadError?: string;
};

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function buildLeadsCsv(leads: AxCheckLeadRecord[]): string {
  const header = ["제출일", "회사", "담당자", "이메일", "연락처", "ref", "등급", "상태", "메모"];
  const rows = leads.map((lead) => [
    formatKstDateTime(lead.createdAt),
    lead.company,
    lead.name,
    lead.email,
    lead.phone ?? "",
    lead.refCode ?? "",
    lead.grade,
    STATUS_LABEL[lead.status] ?? lead.status,
    lead.note ?? "",
  ]);

  const lines = [header, ...rows].map((row) => row.map(csvEscape).join(","));
  return `﻿${lines.join("\n")}`; // BOM — 엑셀에서 한글이 깨지지 않도록
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function AdminLeadsManager({ initialLeads, loadError }: Props) {
  const [leads, setLeads] = useState(initialLeads);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(initialLeads[0]?.id ?? null);

  const selectedLead = useMemo(
    () => leads.find((l) => l.id === selectedId) ?? null,
    [leads, selectedId]
  );

  const handleExportCsv = () => {
    const csv = buildLeadsCsv(leads);
    downloadCsv(csv, `ax-check-leads-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleStatusChange = async (status: LeadStatus) => {
    if (!selectedLead || selectedLead.status === status) return;

    const previousStatus = selectedLead.status;
    setLeads((prev) =>
      prev.map((l) => (l.id === selectedLead.id ? { ...l, status } : l))
    );

    setIsUpdatingStatus(true);
    try {
      const result = await updateAxCheckStatus(selectedLead.id, status);
      if (!result.success) {
        setLeads((prev) =>
          prev.map((l) => (l.id === selectedLead.id ? { ...l, status: previousStatus } : l))
        );
        alert(result.error ?? "상태 변경에 실패했습니다.");
      }
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleSaveNote = async (note: string) => {
    if (!selectedLead) return { success: false, error: "선택된 리드가 없습니다." };

    const result = await updateAxCheckNote(selectedLead.id, note);
    if (result.success) {
      setLeads((prev) =>
        prev.map((l) => (l.id === selectedLead.id ? { ...l, note: note.trim() || null } : l))
      );
    }
    return result;
  };

  const handleDelete = async () => {
    if (!selectedLead) return { success: false, error: "선택된 리드가 없습니다." };

    const result = await deleteAxCheckResponse(selectedLead.id);
    if (result.success) {
      setLeads((prev) => prev.filter((l) => l.id !== selectedLead.id));
      setSelectedId(null);
    }
    return result;
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 text-slate-800">
      {loadError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      ) : null}

      <div className="flex flex-col gap-4 rounded-xl border border-slate-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">AX 체크 리드 관리</h1>
          <p className="text-sm text-slate-500">
            영업이사가 발송한 AX 체크 링크로 접수된 응답을 등급·상태별로 관리합니다.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          disabled={leads.length === 0}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Download className="h-3.5 w-3.5" />
          CSV 내보내기
        </button>
      </div>

      <LeadList leads={leads} selectedId={selectedId} onSelect={setSelectedId} />

      {selectedLead ? (
        <LeadDetailPanel
          lead={selectedLead}
          isUpdatingStatus={isUpdatingStatus}
          onStatusChange={(status) => void handleStatusChange(status)}
          onSaveNote={handleSaveNote}
          onDelete={handleDelete}
        />
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center text-sm text-slate-500">
          목록에서 리드를 선택하면 상세 답변과 관리 도구가 표시됩니다.
        </div>
      )}
    </div>
  );
}
