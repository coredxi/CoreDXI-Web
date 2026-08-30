/**
 * AxCheckIntro.tsx — /ax-check 페이지 상단 인트로 섹션
 *
 * [홍보팀] 문구 자체는 여기가 아니라 src/lib/ax-check/catalog.ts의 INTRO_COPY에서
 * 수정합니다. 별도 게이트 화면이 아니라 같은 페이지 상단에 붙는 섹션이며, 하단 CTA는
 * 클릭 한 번을 늘리지 않도록 폼 앵커(#ax-check-form)로 스크롤만 시킵니다.
 */

import { CheckCircle2 } from "lucide-react";
import { INTRO_COPY } from "@/lib/ax-check/catalog";

export function AxCheckIntro() {
  return (
    <section className="mb-10">
      <p className="text-sm font-semibold text-primary">{INTRO_COPY.eyebrow}</p>
      <h1 className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">
        {INTRO_COPY.headline}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {INTRO_COPY.description}
      </p>

      <ol className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {INTRO_COPY.steps.map((step, i) => (
          <li
            key={step}
            className="rounded-xl border border-border bg-card p-3 text-center text-xs font-medium text-foreground"
          >
            <span className="block text-[11px] text-muted-foreground">{i + 1}단계</span>
            {step}
          </li>
        ))}
      </ol>

      <ul className="mt-6 space-y-2">
        {INTRO_COPY.reassurances.map((text) => (
          <li key={text} className="flex items-start gap-2 text-sm text-foreground/90">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            {text}
          </li>
        ))}
      </ul>

      <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <p className="text-xs font-semibold text-primary">{INTRO_COPY.previewLabel}</p>
        <p className="mt-1 text-sm text-foreground">{INTRO_COPY.previewExample}</p>
      </div>

      <a
        href="#ax-check-form"
        className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        {INTRO_COPY.cta}
      </a>
    </section>
  );
}
