"use client";

/**
 * EmailDraftPanel.tsx — AX 체크 리드 상세의 "이메일 초안" 패널
 *
 * [홍보팀 참고] 여기 보이는 문구 자체는 src/lib/ax-check/email-draft.ts와
 * catalog.ts(SALES_SIGNATURE 등)에서 생성됩니다. 이 파일은 화면(복사·mailto 버튼)만
 * 담당합니다. 자동 발송 기능은 없습니다 — 영업이사가 직접 복사해 보내야 합니다.
 */

import { useState } from "react";
import { Check, Copy, Mail } from "lucide-react";
import { buildCustomerEmailDraft } from "@/lib/ax-check/email-draft";
import type { AxCheckLeadRecord } from "@/lib/ax-check/types";

type Props = { lead: AxCheckLeadRecord };

export function EmailDraftPanel({ lead }: Props) {
  const [copied, setCopied] = useState(false);

  const draft = buildCustomerEmailDraft(
    lead.answers,
    {
      priorities: lead.priorities,
      grade: lead.grade,
      score: lead.score,
      catalogVersion: lead.catalogVersion,
    },
    { company: lead.company, name: lead.name }
  );

  const mailtoHref = `mailto:${lead.email}?subject=${encodeURIComponent(
    draft.subject
  )}&body=${encodeURIComponent(draft.body)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(draft.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("복사에 실패했습니다. 아래 미리보기에서 직접 선택해 복사해 주세요.");
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-slate-100 bg-white p-6 shadow-sm lg:col-span-2">
      <div className="border-b pb-3">
        <h2 className="text-lg font-bold text-slate-900">이메일 초안</h2>
        <p className="mt-0.5 text-xs text-slate-400">
          자동 발송되지 않습니다. 검토·수정 후 아래 복사 버튼으로 붙여넣어 직접
          보내주세요.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-700"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "복사됨" : "초안 복사"}
        </button>
        <a
          href={mailtoHref}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          <Mail className="h-3.5 w-3.5" />
          메일 앱에서 열기
        </a>
        <span className="text-[11px] text-slate-400">
          메일 앱 열기는 본문이 길면 잘릴 수 있어요 — 복사가 기본입니다.
        </span>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-semibold text-slate-500">제목</p>
        <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-800">{draft.subject}</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold text-slate-500">본문 미리보기</p>
        <pre className="whitespace-pre-wrap rounded-lg border border-slate-100 bg-slate-50 p-3 font-sans text-sm leading-relaxed text-slate-800">
          {draft.body}
        </pre>
      </div>
    </div>
  );
}
