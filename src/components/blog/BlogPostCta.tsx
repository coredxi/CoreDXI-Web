/**
 * BlogPostCta.tsx — 블로그 글 상세 하단 CTA
 *
 * 블로그 글의 단일 CTA는 "3분 AX 체크"입니다(2026-10-26 블로그 콘텐츠 재건 트랙).
 * 링크에는 ref=blog-{글주소}가 붙어 /admin/leads에서 어떤 글이 응답으로 이어졌는지 볼 수 있습니다.
 * 뉴스레터 구독 폼은 Footer(BlogShell)에 이미 있으므로 중복 폼을 두지 않고,
 * 안내 문구와 앵커 링크(#newsletter)만 제공합니다.
 * 설계: docs/superpowers/specs/2026-08-14-funnel-dashboard-stage2-design.md 4-5,
 *       docs/superpowers/specs/2026-10-26-blog-attribution-design.md
 */

import { ArrowRight, Mail } from "lucide-react";
import Link from "next/link";
import { TrackedCtaLink } from "@/components/analytics/TrackedCtaLink";
import { withBlogRef } from "@/lib/ax-check/ref";

type Props = {
  /** 글 주소(slug) — AX 체크 링크의 유입 경로(ref) 표시에 사용 */
  slug: string;
};

export function BlogPostCta({ slug }: Props) {
  return (
    <div className="mt-10 rounded-xl border border-border bg-card p-6 shadow-sm md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {/* [홍보팀] 블로그 글을 끝까지 읽은 방문자를 3분 AX 체크(컨설팅 리드)로 전환시키는 문구입니다. */}
          <p className="text-base font-semibold text-foreground">
            우리 회사는 AI를 어디부터 적용하면 좋을까요?
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            9개 질문에 답하면 우리 회사의 AX 우선 과제를 바로 정리해 드립니다.
          </p>
        </div>
        <TrackedCtaLink
          href={withBlogRef("/ax-check", slug)}
          location="blog_post_bottom"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors duration-300 hover:bg-primary/90"
        >
          3분 AX 체크 시작하기
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
