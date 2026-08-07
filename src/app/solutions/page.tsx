import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { ArrowRight, BrainCircuit, BarChart3, Network, CheckCircle2 } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getPageContent } from "@/lib/page-content";
import { SOLUTIONS_CONTENT_DEFAULTS } from "@/lib/page-content/solutions";
import { TrackedCtaLink } from "@/components/analytics/TrackedCtaLink";

export const revalidate = 60;

export const metadata: Metadata = pageMetadata({
  title: "솔루션",
  description:
    "CoreDXI의 AI 기반 AX 전환 솔루션을 소개합니다. AI 협업 자동화, AX 전환 컨설팅, 엔터프라이즈 AI 플랫폼으로 비즈니스 핵심을 강화하세요.",
  path: "/solutions",
});

const SOLUTION_ICONS = [BrainCircuit, BarChart3, Network] as const;
const PROCESS_STEP_NUMBERS = ["01", "02", "03", "04"] as const;

export default async function SolutionsPage() {
  const content = await getPageContent("solutions", SOLUTIONS_CONTENT_DEFAULTS);

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background pt-16">
        {/* ── 히어로 ─────────────────────────────────────────── */}
        <section className="bg-gradient-to-b from-background to-secondary/20 px-6 pb-20 pt-24 text-center">
          <div className="mx-auto max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.06] px-4 py-1.5 text-sm font-medium text-primary">
              {content.heroBadge}
            </div>
            <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight text-foreground sm:text-5xl">
              {content.heroTitleLine1}
              <br />
              <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                {content.heroTitleLine2}
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              {content.heroSubtitle}
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <TrackedCtaLink
                href="/contact"
                location="solutions_hero"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/90"
              >
                무료 도입 상담
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </TrackedCtaLink>
              <Link
                href="/cases"
                className="inline-flex items-center gap-2 rounded-xl border-2 border-primary/30 bg-card px-8 py-4 text-sm font-semibold text-primary dark:text-blue-300 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/60 hover:bg-primary/5"
              >
                성공사례 보기
              </Link>
            </div>
          </div>
        </section>

        {/* ── 솔루션 카드 ──────────────────────────────────────── */}
        <section className="bg-muted px-6 py-20">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 text-center">
              <p className="text-sm font-semibold text-primary">
                {content.solutionsLabel}
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground">
                {content.solutionsTitle}
              </h2>
            </div>
            <div className="grid gap-8 md:grid-cols-3">
              {content.solutions.map((solution, i) => {
                const Icon = SOLUTION_ICONS[i] ?? BrainCircuit;
                return (
                  <div
                    key={solution.title}
                    className="flex flex-col rounded-2xl border border-border bg-card p-8 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                        <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
                      </div>
                      <span className="rounded-full bg-primary/10 px-3 py-0.5 text-xs font-semibold text-primary dark:text-blue-300">
                        {solution.badge}
                      </span>
                    </div>
                    <h3 className="mt-5 text-xl font-bold text-foreground">
                      {solution.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {solution.desc}
                    </p>
                    <ul className="mt-6 flex-1 space-y-2">
                      {solution.features.map((f) => (
                        <li
                          key={f}
                          className="flex items-start gap-2 text-sm text-muted-foreground"
                        >
                          <CheckCircle2
                            className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                            aria-hidden="true"
                          />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <TrackedCtaLink
                      href="/contact"
                      location="solutions_mid"
                      className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-primary/90"
                    >
                      도입 문의
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </TrackedCtaLink>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── 도입 프로세스 ─────────────────────────────────────── */}
        <section className="px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <div className="mb-12 text-center">
              <p className="text-sm font-semibold text-primary">
                {content.processLabel}
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground">
                {content.processTitle}
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
                {content.processDesc}
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {content.processSteps.map((step, i) => (
                <div
                  key={step.title}
                  className="relative rounded-2xl border border-border bg-card p-6 shadow-sm"
                >
                  <span className="text-5xl font-black text-primary/15">
                    {PROCESS_STEP_NUMBERS[i] ?? String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-2 text-lg font-bold text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────────── */}
        <section className="bg-primary px-6 py-20">
          <div className="mx-auto max-w-3xl text-center text-white">
            <h2 className="text-3xl font-bold tracking-tight">
              {content.ctaTitle}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white/70">
              {content.ctaDesc}
            </p>
            <TrackedCtaLink
              href="/contact"
              location="solutions_bottom"
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-sm font-semibold text-primary shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl dark:text-blue-300"
            >
              무료 도입 상담 신청
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </TrackedCtaLink>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
