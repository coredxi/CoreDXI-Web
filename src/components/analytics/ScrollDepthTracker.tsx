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
    // 관리자 페이지는 방문자 퍼널 분석 대상이 아님 — /admin 경로는 스크롤 추적을 건너뛴다
    if (pathname.startsWith("/admin")) return;

    firedRef.current = new Set();
    let ticking = false;
    let rafId = 0;

    function handleScroll() {
      if (ticking) return;
      ticking = true;
      rafId = window.requestAnimationFrame(() => {
        try {
          const doc = document.documentElement;
          const scrollableHeight = doc.scrollHeight - doc.clientHeight;
          // 페이지가 화면보다 짧아 스크롤이 불가능하면 이미 전부 읽은 것으로 간주해 100%로 처리한다
          const percent =
            scrollableHeight <= 0
              ? 100
              : Math.round((window.scrollY / scrollableHeight) * 100);

          for (const threshold of getNewlyReachedThresholds(percent, firedRef.current)) {
            firedRef.current.add(threshold);
            trackEvent("scroll_depth", { percent: threshold });
          }
        } finally {
          ticking = false;
        }
      });
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    // 스크롤이 아예 발생하지 않는 짧은 페이지도 측정하도록 마운트 직후 한 번 실행한다
    handleScroll();
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.cancelAnimationFrame(rafId);
    };
  }, [pathname]);

  return null;
}
