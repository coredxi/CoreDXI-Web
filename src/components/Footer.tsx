import Link from "next/link";
import { TrackedCtaLink } from "@/components/analytics/TrackedCtaLink";
import { ArrowRight } from "lucide-react";
import { NewsletterSubscribeForm } from "@/components/newsletter/NewsletterSubscribeForm";

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <p className="text-lg font-bold tracking-tight text-foreground">
              CoreDXI
            </p>
            <p className="text-sm text-muted-foreground">
              © 2026 CoreDXI. All rights reserved.
            </p>
          </div>

          {/* id="newsletter" — 블로그 글 하단 CTA(BlogPostCta) 등에서 앵커 링크(#newsletter)로 이동시키는 대상 */}
          <div id="newsletter" className="w-full max-w-sm scroll-mt-24">
            <NewsletterSubscribeForm source="footer" className="w-full" />
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-muted-foreground">
            <Link
              href="/terms"
              className="transition-colors duration-300 hover:text-foreground"
            >
              이용약관
            </Link>
            <Link
              href="/privacy"
              className="transition-colors duration-300 hover:text-foreground"
            >
              개인정보처리방침
            </Link>
            <TrackedCtaLink
              href="/contact"
              location="footer"
              className="inline-flex items-center gap-2 text-primary transition-colors duration-300 hover:text-primary/80"
            >
              문의하기
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </TrackedCtaLink>
          </div>
        </div>
      </div>
    </footer>
  );
}
