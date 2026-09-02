import type { FollowupStatus } from "@/lib/ax-check/types";

export const FOLLOWUP_STATUS_LABEL: Record<FollowupStatus, string> = {
  SCHEDULED: "예정",
  HELD: "보류",
  SENDING: "발송 중",
  SENT: "발송 완료",
  FAILED: "실패",
  SKIPPED: "과도기(수동)",
};

const STATUS_BADGE: Record<FollowupStatus, string> = {
  SCHEDULED: "bg-indigo-50 text-indigo-600",
  HELD: "bg-amber-50 text-amber-600",
  SENDING: "bg-slate-100 text-slate-500",
  SENT: "bg-emerald-50 text-emerald-600",
  FAILED: "bg-red-50 text-red-600",
  SKIPPED: "bg-slate-100 text-slate-500",
};

export function FollowupStatusBadge({ status }: { status: FollowupStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_BADGE[status]}`}
    >
      {FOLLOWUP_STATUS_LABEL[status]}
    </span>
  );
}
