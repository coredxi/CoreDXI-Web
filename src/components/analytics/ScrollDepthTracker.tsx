"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackEvent } from "@/lib/ga4-events";
import { getNewlyReachedThresholds, type ScrollThreshold } from "@/lib/scroll-depth";

/**
 * ScrollDepthTracker — 모든 공개 페이지에서 스크롤 깊이(25/50/75/100%)를
 * GA4 scroll_depth 이벤트로 전송한다. 화면에는 아무것도 렌더링하지 않으며
 * layout.tsx에 한 번만 마운트한다. 페이지 이동 시 임계값 기록을 초기화한다.
 */
export function ScrollDepthTracker() {
  const pathname = usePathname();
  const firedRef = useRef<Set<ScrollThreshold>>(new Set());

  useEffect(() => {
    firedRef.current = new Set();
    let ticking = false;

    function handleScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const doc = document.documentElement;
        const scrollableHeight = doc.scrollHeight - doc.clientHeight;
        const percent =
          scrollableHeight <= 0
            ? 100
            : Math.round((window.scrollY / scrollableHeight) * 100);

        for (const threshold of getNewlyReachedThresholds(percent, firedRef.current)) {
          firedRef.current.add(threshold);
          trackEvent("scroll_depth", { percent: threshold });
        }
        ticking = false;
      });
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [pathname]);

  return null;
}
