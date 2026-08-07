"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { trackEvent } from "@/lib/ga4-events";

type Props = ComponentProps<typeof Link> & {
  /** 클릭 위치 식별자 (예: "hero_primary", "footer") — GA4 cta_location 파라미터로 전송 */
  location: string;
};

export function TrackedCtaLink({ location, onClick, ...linkProps }: Props) {
  return (
    <Link
      {...linkProps}
      onClick={(e) => {
        trackEvent("cta_click", { cta_location: location });
        onClick?.(e);
      }}
    />
  );
}
