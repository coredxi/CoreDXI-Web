import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { ArrowRight, Target, Users, Zap, Shield } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getPageContent } from "@/lib/page-content";
import { ABOUT_CONTENT_DEFAULTS } from "@/lib/page-content/about";
import { TrackedCtaLink } from "@/components/analytics/TrackedCtaLink";

export const revalidate = 60;

export const metadata: Metadata = pageMetadata({
  title: "회사 소개",
  description:
    "CoreDXI는 기업의 비즈니스 핵심을 AI로 깨우는 AX 전환 전문 파트너입니다. 복잡한 협업을 심플하게, 변화는 단단하게 설계합니다.",
  path: "/about",
});

const MISSION_FEATURE_ICONS = [Target, Zap, Users, Shield] as const;
const VALUE_NUMBERS = ["01", "02", "03"] as const;

export default async function AboutPage() {
  const content = await getPageContent("about", ABOUT_CONTENT_DEFAULTS);

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
          </div>
        </section>

        {/* ── 미션 ─────────────────────────────────────────────── */}
        <section className="bg-card px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <div className="grid gap-12 md:grid-cols-2 md:items-center">
              <div>
                <p className="text-sm font-semibold text-primary dark:text-blue-300">
                  {content.missionLabel}
                </p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground">
                  {content.missionTitleLine1}
                  <br />
                  {content.missionTitleLine2}
                </h2>
                <p className="mt-5 text-base leading-relaxed text-muted-foreground">
                  {content.missionParagraph1}
                </p>
                <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                  {content.missionParagraph2}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {content.missionFeatures.map((feature, i) => {
                  const Icon = MISSION_FEATURE_ICONS[i] ?? Target;
                  return (
                    <div
                      key={feature.title}
                      className="rounded-xl border border-border bg-secondary/30 p-5"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                      </div>
                      <p className="mt-3 font-semibold text-foreground">
                        {feature.title}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {feature.desc}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ── 핵심 가치 ─────────────────────────────────────────── */}
        <section className="px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <div className="text-center">
              <p className="text-sm font-semibold text-primary">
                {content.valuesLabel}
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground">
                {content.valuesTitle}
              </h2>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-3">
              {content.values.map((v, i) => (
                <div
                  key={v.title}
                  className="rounded-2xl border border-border bg-card p-8 shadow-sm"
                >
                  <span className="text-4xl font-black text-primary/20">
                    {VALUE_NUMBERS[i] ?? "0" + (i + 1)}
                  </span>
                  <h3 className="mt-4 text-xl font-bold text-foreground">
                    {v.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {v.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 수치 ─────────────────────────────────────────────── */}
        <section className="bg-primary px-6 py-16">
          <div className="mx-auto max-w-5xl">
            <div className="grid grid-cols-3 gap-8 text-center text-white">
              {content.stats.map((s) => (
                <div key={s.label}>
                  <p className="text-4xl font-extrabold">{s.value}</p>
                  <p className="mt-2 text-sm text-white/70">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────────── */}
        <section className="px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              {content.ctaTitle}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              {content.ctaDesc}
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <TrackedCtaLink
                href="/contact"
                location="about_cta"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30"
              >
                도입 문의하기
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </TrackedCtaLink>
              <Link
                href="/solutions"
                className="inline-flex items-center gap-2 rounded-xl border-2 border-primary/30 bg-card px-8 py-4 text-sm font-semibold text-primary dark:text-blue-300 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/60 hover:bg-primary/5"
              >
                솔루션 보기
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
