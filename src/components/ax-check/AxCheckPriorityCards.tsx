/**
 * AxCheckPriorityCards.tsx — AX 체크 우선 과제 카드 UI
 *
 * 제출 직후 결과 화면(AxCheckForm)과 메일 링크 재열람 페이지(/ax-check/result/[token])가
 * 동일한 카드 UI를 공유한다. [홍보팀] 카드 문구 자체는 src/lib/ax-check/catalog.ts에서 관리합니다.
 */

import { ArrowRight, Lightbulb } from "lucide-react";
import { TrackedCtaLink } from "@/components/analytics/TrackedCtaLink";
import type { AxCheckPriority } from "@/lib/ax-check/summarize";

type Props = {
  company?: string;
  priorities: AxCheckPriority[];
};

export function AxCheckPriorityCards({ company, priorities }: Props) {
  return (
    <div className="mx-auto w-full max-w-md">
      <div className="text-center">
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Lightbulb className="size-6" aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-lg font-bold text-foreground">
          {company ? `${company}의 ` : ""}AX 우선 과제 3가지
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          정리된 상세 진단서를 영업일 기준 2~3일 내 메일로 보내드립니다. 우선 과제가 뚜렷한
          경우 담당 이사가 직접 연락드립니다.
        </p>
      </div>

      <ol className="mt-6 space-y-3">
        {priorities.map((priority, index) => (
          <li
            key={`${priority.title}-${index}`}
            className="rounded-xl border border-border bg-card p-4 shadow-sm"
          >
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {index + 1}
              </span>
              {priority.title}
            </p>
            <p className="mt-2 text-xs font-medium text-primary">{priority.echo}</p>
            {priority.industryExample ? (
              <p className="mt-1 text-xs text-muted-foreground">{priority.industryExample}</p>
            ) : null}
            <p className="mt-2 text-sm text-muted-foreground">{priority.why}</p>
            <dl className="mt-3 space-y-1.5 text-xs text-muted-foreground">
              <div className="flex gap-1.5">
                <dt className="shrink-0 font-medium text-foreground">첫 1주</dt>
                <dd>{priority.roadmap[0]}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="shrink-0 font-medium text-foreground">첫 1개월</dt>
                <dd>{priority.roadmap[1]}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="shrink-0 font-medium text-foreground">3개월</dt>
                <dd>{priority.roadmap[2]}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="shrink-0 font-medium text-foreground">기대 효과</dt>
                <dd>{priority.expectedEffect}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ol>

      <div className="mt-8 flex flex-col gap-2.5">
        <TrackedCtaLink
          href="/contact"
          location="ax_check_result"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          담당자와 상담하기
          <ArrowRight className="size-4" aria-hidden="true" />
        </TrackedCtaLink>
      </div>
    </div>
  );
}
