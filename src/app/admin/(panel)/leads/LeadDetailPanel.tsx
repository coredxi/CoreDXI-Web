"use client";

import { useEffect, useState } from "react";
import { Mail, Phone, Save, Trash2, User } from "lucide-react";
import { formatKstDateTime } from "@/lib/format-kst-date";
import { AX_CHECK_QUESTIONS, getOptionLabel, getQuestionById } from "@/lib/ax-check/catalog";
import type { AxCheckLeadRecord, LeadStatus } from "@/lib/ax-check/types";
import { LEAD_STATUS_OPTIONS } from "@/lib/ax-check/types";
import { LeadGradeBadge } from "./LeadGradeBadge";
import { EmailDraftPanel } from "./EmailDraftPanel";

type Props = {
  lead: AxCheckLeadRecord;
  isUpdatingStatus: boolean;
  onStatusChange: (status: LeadStatus) => void;
  onSaveNote: (note: string) => Promise<{ success: boolean; error?: string }>;
  onDelete: () => Promise<{ success: boolean; error?: string }>;
};

function formatAnswerValue(questionId: string, value: string | string[]): string {
  const question = getQuestionById(questionId);
  if (Array.isArray(value)) {
    return value.map((v) => getOptionLabel(question, v)).join(", ") || "—";
  }
  return getOptionLabel(question, value) || "—";
}

export function LeadDetailPanel({
  lead,
  isUpdatingStatus,
  onStatusChange,
  onSaveNote,
  onDelete,
}: Props) {
  const [note, setNote] = useState(lead.note ?? "");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setNote(lead.note ?? "");
  }, [lead.id, lead.note]);

  const handleSaveNote = async () => {
    setIsSavingNote(true);
    try {
      const result = await onSaveNote(note);
      if (!result.success) {
        alert(result.error ?? "메모 저장에 실패했습니다.");
      }
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`${lead.company} 리드를 완전히 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }
    setIsDeleting(true);
    try {
      const result = await onDelete();
      if (!result.success) {
        alert(result.error ?? "삭제에 실패했습니다.");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-4 rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">{lead.company}</h2>
            <LeadGradeBadge grade={lead.grade} />
          </div>
          <span className="text-xs text-slate-400">
            {formatKstDateTime(lead.createdAt)} 제출
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-4 text-sm">
          <div>
            <span className="block text-xs font-medium text-slate-400">담당자</span>
            <div className="mt-1 flex items-center gap-1 font-semibold text-slate-700">
              <User className="h-4 w-4 text-slate-500" />
              {lead.name}
            </div>
          </div>
          <div>
            <span className="block text-xs font-medium text-slate-400">이메일</span>
            <div className="mt-1 flex items-center gap-1 font-mono text-xs text-slate-700">
              <Mail className="h-4 w-4 shrink-0 text-slate-500" />
              {lead.email}
            </div>
          </div>
          <div>
            <span className="block text-xs font-medium text-slate-400">연락처</span>
            <div className="mt-1 flex items-center gap-1 text-slate-700">
              <Phone className="h-4 w-4 text-slate-500" />
              {lead.phone ?? "—"}
            </div>
          </div>
          <div>
            <span className="block text-xs font-medium text-slate-400">유입 경로(ref)</span>
            <span className="mt-1 block font-mono text-xs text-slate-700">
              {lead.refCode ?? "—"}
            </span>
          </div>
        </div>

        <div>
          <span className="mb-1 block text-xs font-medium text-slate-400">전체 답변</span>
          <dl className="space-y-2 rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm">
            {AX_CHECK_QUESTIONS.map((q) => (
              <div key={q.id} className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                <dt className="shrink-0 text-xs font-medium text-slate-500 sm:w-64">
                  {q.prompt}
                </dt>
                <dd className="text-slate-700">
                  {formatAnswerValue(q.id, lead.answers[q.id as keyof typeof lead.answers] as string | string[])}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div>
            <label htmlFor="lead-status" className="mb-1 block text-xs font-medium text-slate-400">
              처리 상태
            </label>
            <select
              id="lead-status"
              value={lead.status}
              disabled={isUpdatingStatus}
              onChange={(e) => onStatusChange(e.target.value as LeadStatus)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              {LEAD_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {isDeleting ? "삭제 중..." : "삭제(개인정보 파기)"}
          </button>
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="border-b pb-3">
          <h2 className="text-lg font-bold text-slate-900">AX 우선 과제 요약</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            제출 당시 규칙 기반으로 계산된 결과입니다(카탈로그 {lead.catalogVersion}).
          </p>
        </div>

        <ol className="space-y-2">
          {lead.priorities.map((p, i) => (
            <li key={`${p.title}-${i}`} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
              <p className="font-semibold text-slate-900">
                {i + 1}. {p.title}
              </p>
              <p className="mt-1 text-xs text-indigo-600">{p.echo}</p>
              {p.industryExample ? (
                <p className="mt-1 text-xs text-slate-500">{p.industryExample}</p>
              ) : null}
              <p className="mt-1 text-xs text-slate-500">{p.why}</p>
              <p className="mt-1 text-xs text-slate-600">첫 1주: {p.roadmap[0]}</p>
              <p className="text-xs text-slate-600">첫 1개월: {p.roadmap[1]}</p>
              <p className="text-xs text-slate-600">3개월: {p.roadmap[2]}</p>
              <p className="text-xs text-slate-600">기대 효과: {p.expectedEffect}</p>
            </li>
          ))}
        </ol>

        <div>
          <label htmlFor="lead-note" className="mb-1 block text-xs font-semibold text-slate-500">
            영업 메모
          </label>
          <textarea
            id="lead-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="통화 내용, 다음 액션 등을 기록하세요."
            className="h-32 w-full resize-none rounded-lg border border-slate-200 p-3 text-sm leading-relaxed focus:border-indigo-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleSaveNote}
            disabled={isSavingNote}
            className="mt-2 flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-3.5 w-3.5" />
            {isSavingNote ? "저장 중..." : "메모 저장"}
          </button>
        </div>
      </div>

      <EmailDraftPanel lead={lead} />
    </div>
  );
}
