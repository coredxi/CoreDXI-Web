import type { LeadGrade } from "@/lib/ax-check/types";

const GRADE_LABEL: Record<LeadGrade, string> = {
  HOT: "HOT",
  WARM: "WARM",
  COLD: "COLD",
};

const GRADE_BADGE: Record<LeadGrade, string> = {
  HOT: "bg-red-50 text-red-600",
  WARM: "bg-orange-50 text-orange-600",
  COLD: "bg-slate-100 text-slate-500",
};

export function LeadGradeBadge({ grade }: { grade: LeadGrade }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${GRADE_BADGE[grade]}`}
    >
      {GRADE_LABEL[grade]}
    </span>
  );
}
