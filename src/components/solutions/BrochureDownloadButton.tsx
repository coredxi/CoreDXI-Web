"use client";

import { Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { trackEvent } from "@/lib/ga4-events";
import { cn } from "@/lib/utils";

type Props = {
  /** 소개서 PDF 경로 또는 URL — SolutionsContent.brochureUrl */
  href: string;
  /** 버튼 문구 — SolutionsContent.brochureLabel */
  label: string;
  /** GA4 cta_click 이벤트의 cta_location 값 */
  location: string;
  className?: string;
};

/**
 * [홍보팀] AX 컨설팅 카드 하단 "소개서 PDF 다운로드" 보조 버튼.
 * 정적 파일이라 next/link(TrackedCtaLink)가 아닌 일반 <a download> 태그를 쓰되,
 * TrackedCtaLink와 동일한 방식(GA4 cta_click)으로 클릭을 추적한다.
 * 문구·URL은 관리자 → 솔루션 관리 화면(/admin/solutions)에서 코드 수정 없이 바꿀 수 있다.
 */
export function BrochureDownloadButton({ href, label, location, className }: Props) {
  return (
    <a
      href={href}
      download
      target="_blank"
      rel="noopener"
      onClick={() => trackEvent("cta_click", { cta_location: location })}
      className={cn(
        buttonVariants({ variant: "outline", size: "lg" }),
        "w-full gap-2 rounded-xl",
        className
      )}
    >
      <Download aria-hidden="true" />
      {label}
    </a>
  );
}
