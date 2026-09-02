"use client";

/**
 * EmailDraftPanel.tsx — AX 체크 리드 상세의 "팔로업 메일" 패널
 *
 * [홍보팀 참고] 여기 보이는 문구 자체는 src/lib/ax-check/email-draft.ts와
 * catalog.ts(SALES_SIGNATURE·FOLLOWUP_COPY)에서 생성됩니다. T1(상세 진단)은
 * 시스템(Vercel Cron)이 예정 시각에 자동 발송합니다 — 발송 전에는 이 패널에서
 * 보류·수정·즉시 발송할 수 있습니다.
 */

import { useState } from "react";
import { AlertCircle, Check, Copy, Mail, Pause, Play, RotateCcw, Send } from "lucide-react";
import {
  holdAxCheckFollowup,
  resetAxCheckFollowupDraft,
  resumeAxCheckFollowup,
  sendAxCheckFollowupNow,
  updateAxCheckFollowupDraft,
} from "@/actions/ax-check";
import { buildCustomerEmailDraft } from "@/lib/ax-check/email-draft";
import { formatKstDateTime } from "@/lib/format-kst-date";
import type { AxCheckLeadRecord } from "@/lib/ax-check/types";
import { FollowupStatusBadge } from "./FollowupStatusBadge";

type Props = {
  lead: AxCheckLeadRecord;
  /** 액션 성공 직후 상위(AdminLeadsManager) 상태를 갱신해 중복 발송 클릭을 막는다. */
  onLeadPatch: (patch: Partial<AxCheckLeadRecord>) => void;
};

export function EmailDraftPanel({ lead, onLeadPatch }: Props) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [subjectDraft, setSubjectDraft] = useState(lead.followupSubject ?? "");
  const [bodyDraft, setBodyDraft] = useState(lead.followupBody ?? "");
  const [isPending, setIsPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const autoDraft = buildCustomerEmailDraft(
    lead.answers,
    {
      priorities: lead.priorities,
      grade: lead.grade,
      score: lead.score,
      catalogVersion: lead.catalogVersion,
    },
    { company: lead.company, name: lead.name },
    // 실제 자동 발송(followup.ts)과 동일한 mode:auto — 미리보기·수정 시드가 실제 발송본과
    // 달라지지 않도록 반드시 맞춰야 한다.
    { mode: "auto" }
  );

  const hasOverride = Boolean(lead.followupSubject && lead.followupBody);
  const previewSubject = lead.followupSubject ?? autoDraft.subject;
  const previewBody = lead.followupBody ?? autoDraft.body;

  const mailtoHref = `mailto:${encodeURIComponent(lead.email)}?subject=${encodeURIComponent(
    previewSubject
  )}&body=${encodeURIComponent(previewBody)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(previewBody);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("복사에 실패했습니다. 아래 미리보기에서 직접 선택해 복사해 주세요.");
    }
  };

  async function runAction(
    action: () => Promise<{ success: boolean; error?: string }>
  ): Promise<boolean> {
    setIsPending(true);
    setActionError(null);
    try {
      const result = await action();
      if (!result.success) {
        setActionError(result.error ?? "처리 중 오류가 발생했습니다.");
        return false;
      }
      return true;
    } finally {
      setIsPending(false);
    }
  }

  const handleHold = async () => {
    if (await runAction(() => holdAxCheckFollowup(lead.id))) {
      onLeadPatch({ followupStatus: "HELD" });
    }
  };

  const handleResume = async () => {
    // followupScheduledAt은 서버가 재계산하므로 클라이언트에서 추측하지 않는다
    // (다음 페이지 로드까지 잠깐 옛 값이 보일 수 있으나 상태 자체는 정확해진다).
    if (await runAction(() => resumeAxCheckFollowup(lead.id))) {
      onLeadPatch({ followupStatus: "SCHEDULED" });
    }
  };

  const handleSendNow = async () => {
    const message =
      lead.followupStatus === "SENT"
        ? `${lead.company}에 팔로업 메일을 다시 보낼까요?`
        : `${lead.company}에 팔로업 메일을 지금 보낼까요?`;
    if (!confirm(message)) return;
    if (await runAction(() => sendAxCheckFollowupNow(lead.id))) {
      onLeadPatch({ followupStatus: "SENT" });
    }
  };

  const handleSaveDraft = async () => {
    const trimmedSubject = subjectDraft.trim();
    const trimmedBody = bodyDraft.trim();
    const success = await runAction(() =>
      updateAxCheckFollowupDraft(lead.id, trimmedSubject, trimmedBody)
    );
    if (success) {
      onLeadPatch({ followupSubject: trimmedSubject, followupBody: trimmedBody });
      setIsEditing(false);
    }
  };

  const handleResetDraft = async () => {
    if (await runAction(() => resetAxCheckFollowupDraft(lead.id))) {
      onLeadPatch({ followupSubject: null, followupBody: null });
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-slate-100 bg-white p-6 shadow-sm lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">팔로업 메일</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            T1(상세 진단)은 시스템이 예정 시각에 자동 발송합니다. 필요하면 보류·수정·즉시 발송할
            수 있어요.
          </p>
        </div>
        <FollowupStatusBadge status={lead.followupStatus} />
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-4 text-xs sm:grid-cols-4">
        <div>
          <span className="block font-medium text-slate-400">T0 요약 메일</span>
          <span className="mt-1 block text-slate-700">
            {lead.t0SentAt ? formatKstDateTime(lead.t0SentAt) : "미발송"}
          </span>
        </div>
        <div>
          <span className="block font-medium text-slate-400">T1 예정 시각</span>
          <span className="mt-1 block text-slate-700">
            {lead.followupScheduledAt ? formatKstDateTime(lead.followupScheduledAt) : "—"}
          </span>
        </div>
        <div>
          <span className="block font-medium text-slate-400">T1 발송 시각</span>
          <span className="mt-1 block text-slate-700">
            {lead.followupSentAt ? formatKstDateTime(lead.followupSentAt) : "—"}
          </span>
        </div>
        <div>
          <span className="block font-medium text-slate-400">재시도 횟수</span>
          <span className="mt-1 block text-slate-700">{lead.followupAttempts}회</span>
        </div>
      </div>

      {lead.followupError ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{lead.followupError}</span>
        </div>
      ) : null}

      {actionError ? (
        <p className="text-xs text-red-600" role="alert">
          {actionError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {(lead.followupStatus === "SCHEDULED" || lead.followupStatus === "FAILED") && (
          <button
            type="button"
            onClick={() => void handleHold()}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Pause className="h-3.5 w-3.5" />
            보류
          </button>
        )}
        {lead.followupStatus === "HELD" && (
          <button
            type="button"
            onClick={() => void handleResume()}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Play className="h-3.5 w-3.5" />
            보류 해제
          </button>
        )}
        <button
          type="button"
          onClick={() => void handleSendNow()}
          disabled={isPending}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Send className="h-3.5 w-3.5" />
          {lead.followupStatus === "SENT" ? "다시 보내기" : "지금 보내기"}
        </button>
        <button
          type="button"
          onClick={() => {
            setSubjectDraft(lead.followupSubject ?? autoDraft.subject);
            setBodyDraft(lead.followupBody ?? autoDraft.body);
            setIsEditing((v) => !v);
          }}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          {isEditing ? "수정 취소" : "본문 수정"}
        </button>
        {hasOverride ? (
          <button
            type="button"
            onClick={() => void handleResetDraft()}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            초안으로 되돌리기
          </button>
        ) : null}
      </div>

      {isEditing ? (
        <div className="space-y-2 rounded-lg border border-slate-100 bg-slate-50 p-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500">제목</label>
            <input
              value={subjectDraft}
              onChange={(e) => setSubjectDraft(e.target.value)}
              className="w-full rounded-lg border border-slate-200 p-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500">본문</label>
            <textarea
              value={bodyDraft}
              onChange={(e) => setBodyDraft(e.target.value)}
              className="h-64 w-full resize-none rounded-lg border border-slate-200 p-3 text-sm leading-relaxed"
            />
          </div>
          <button
            type="button"
            onClick={() => void handleSaveDraft()}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            저장
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "복사됨" : "본문 복사"}
        </button>
        <a
          href={mailtoHref}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          <Mail className="h-3.5 w-3.5" />
          메일 앱에서 열기
        </a>
        <span className="text-[11px] text-slate-400">
          {hasOverride ? "수정된 본문을 발송합니다." : "자동 생성된 초안입니다(발송 시점에 다시 생성)."}
        </span>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-semibold text-slate-500">제목</p>
        <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-800">{previewSubject}</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold text-slate-500">본문 미리보기</p>
        <pre className="whitespace-pre-wrap rounded-lg border border-slate-100 bg-slate-50 p-3 font-sans text-sm leading-relaxed text-slate-800">
          {previewBody}
        </pre>
      </div>
    </div>
  );
}
