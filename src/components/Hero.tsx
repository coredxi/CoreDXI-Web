/**
 * Hero.tsx — 히어로 섹션 (첫 화면)
 *
 * 홈페이지에서 헤더 바로 아래에 표시되는 메인 소개 섹션입니다.
 * 콘텐츠는 관리자 페이지(/admin/main)에서 편집한 값을 PageContent 테이블에서
 * 불러오며, 아직 저장된 값이 없으면 HOME_CONTENT_DEFAULTS를 사용합니다.
 */

import Image from "next/image";
import { getPageContent } from "@/lib/page-content";
import { HOME_CONTENT_DEFAULTS } from "@/lib/page-content/home";
import { TrackedCtaLink } from "@/components/analytics/TrackedCtaLink";

export async function Hero() {
  const content = await getPageContent("home", HOME_CONTENT_DEFAULTS);
  const titleLines = content.title.split("\n");

  return (
    <section
      className="relative min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center overflow-hidden bg-background px-6 pt-28 pb-16 text-center"
      aria-labelledby="hero-title"
    >
      {/* 배경 장식: 미세한 그리드 패턴 */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]">
        <div className="absolute inset-0 bg-background [mask-image:linear-gradient(180deg,transparent,rgba(255,255,255,0.9)_80%)]"></div>
      </div>

      <div className="mx-auto w-full max-w-5xl space-y-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-transparent px-4 py-1.5 text-sm font-semibold text-muted-foreground shadow-sm">
          {content.badge}
        </div>

        <h1
          id="hero-title"
          className="text-5xl font-extrabold leading-[1.05] tracking-tighter text-foreground sm:text-6xl lg:text-7xl xl:text-8xl"
        >
          {titleLines.map((line, i) => (
            <span key={i} className="block">
              {i === 0 ? (
                <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  {line}
                </span>
              ) : (
                <span className="text-foreground">{line}</span>
              )}
            </span>
          ))}
        </h1>

        <p className="mx-auto max-w-2xl whitespace-pre-line text-lg leading-relaxed text-muted-foreground sm:text-xl lg:text-2xl">
          {content.subtitle}
        </p>

        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
          <TrackedCtaLink
            href={content.primaryCtaHref}
            location="hero_primary"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-8 py-4 text-base font-semibold text-white shadow-[0_4px_14px_0_rgba(79,70,229,0.39)] transition-all duration-200 hover:bg-primary/90 hover:shadow-[0_6px_20px_rgba(79,70,229,0.23)] hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-0 sm:w-auto"
          >
            {content.primaryCtaText}
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
            </svg>
          </TrackedCtaLink>

          <a
            href={content.secondaryCtaHref}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-8 py-4 text-base font-semibold text-foreground shadow-sm transition-all duration-200 hover:bg-accent hover:border-border hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-0 sm:w-auto"
          >
            {content.secondaryCtaText}
          </a>
        </div>

        <div className="relative mx-auto mt-4 w-full max-w-4xl">
          {content.imageSrc ? (
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl shadow-2xl shadow-primary/10 ring-1 ring-border">
              <Image
                src={content.imageSrc}
                alt={content.imageAlt}
                fill
                className="object-cover"
                priority
                sizes="(max-width: 768px) 100vw, (max-width: 1280px) 80vw, 896px"
              />
            </div>
          ) : (
            <div
              className="relative flex aspect-video w-full flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl border-2 border-dashed border-primary/20 bg-gradient-to-br from-secondary/50 to-background shadow-xl shadow-primary/5"
              role="img"
              aria-label="서비스 예시 이미지 영역 (준비 중)"
            >
              <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />

              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-card shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary/50" aria-hidden="true">
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <path d="m9 9 5 12 1.774-5.226L21 14 9 9z" />
                </svg>
              </div>

              <div className="relative text-center">
                <p className="text-sm font-semibold text-primary/60">서비스 화면 이미지</p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  /admin/main에서 이미지 URL을 등록하세요
                </p>
              </div>

              <div aria-hidden="true" className="absolute bottom-4 left-4 right-4 flex gap-2 opacity-30">
                <div className="h-2 flex-1 rounded-full bg-primary/40" />
                <div className="h-2 w-1/3 rounded-full bg-primary/20" />
                <div className="h-2 w-1/4 rounded-full bg-primary/30" />
              </div>
            </div>
          )}

          <div aria-hidden="true" className="absolute -bottom-px left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent" />
        </div>

        <div className="flex flex-col items-center gap-6 pt-2 sm:flex-row sm:justify-center sm:gap-12">
          {content.stats.map((stat, i) => (
            <div key={stat.label} className="flex items-center gap-6 sm:contents">
              {i > 0 && (
                <div className="hidden h-8 w-px bg-border sm:block" aria-hidden="true" />
              )}
              <div className="flex flex-col items-center gap-1">
                <span className="text-2xl font-bold text-foreground">{stat.value}</span>
                <span className="text-sm text-muted-foreground">{stat.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce text-muted-foreground/40"
        aria-hidden="true"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    </section>
  );
}
