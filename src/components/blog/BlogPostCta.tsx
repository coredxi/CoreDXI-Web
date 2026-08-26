/**
 * BlogPostCta.tsx — 블로그 글 상세 하단 CTA
 *
 * 문의(컨설팅 리드) 유도 링크 + 뉴스레터 안내 문구를 블로그 글 하단에 표시합니다.
 * 뉴스레터 구독 폼은 Footer(BlogShell)에 이미 있으므로 중복 폼을 두지 않고,
 * 안내 문구와 앵커 링크(#newsletter)만 제공합니다.
 * 설계: docs/superpowers/specs/2026-08-14-funnel-dashboard-stage2-design.md 4-5
 */

import { ArrowRight, Mail } from "lucide-react";
import Link from "next/link";
import { TrackedCtaLink } from "@/components/analytics/TrackedCtaLink";

export function BlogPostCta() {
  return (
    <div className="mt-10 rounded-xl border border-border bg-card p-6 shadow-sm md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {/* [홍보팀] 블로그 글을 끝까지 읽은 방문자를 문의(컨설팅 리드)로 전환시키는 문구입니다. */}
          <p className="text-base font-semibold text-foreground">
            우리 조직에 AX가 필요한지 궁금하신가요?
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            CoreDXI와 함께 AI 전환의 첫 단계를 진단해 보세요.
          </p>
        </div>
        <TrackedCtaLink
          href="/contact"
          location="blog_post_bottom"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors duration-300 hover:bg-primary/90"
        >
          문의하기
          <ArrowRight className="size-4" aria-hidden="true" />
        </TrackedCtaLink>
      </div>

      <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Mail className="size-3.5 shrink-0" aria-hidden="true" />
        더 많은 AI/AX 인사이트는{" "}
        <Link href="#newsletter" className="font-medium text-primary underline underline-offset-2">
          아래 뉴스레터
        </Link>
        로 받아보세요.
      </p>
    </div>
  );
}
