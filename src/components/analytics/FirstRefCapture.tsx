"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { storeFirstRef } from "@/lib/ax-check/ref";

/**
 * FirstRefCapture — 방문자가 `?ref=xxx` 링크(영업 링크 등)로 처음 들어오면 그 ref를
 * 탭(세션) 단위 sessionStorage에 보관한다. 이후 ref 없이 /ax-check에 도착해도
 * AxCheckForm이 이 값을 이어받아 유입 경로를 기록한다. 화면에는 아무것도 렌더링하지 않으며
 * layout.tsx에 한 번만 마운트한다. 설계: docs/superpowers/specs/2026-10-26-blog-attribution-design.md
 *
 * [홍보팀] 쿠키가 아니라 브라우저 탭을 닫으면 지워지는 임시 저장소를 사용합니다(개인정보 아님).
 */
export function FirstRefCapture() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    try {
      const ref = new URLSearchParams(window.location.search).get("ref");
      storeFirstRef(window.sessionStorage, ref);
    } catch {
      // sessionStorage 접근 자체가 막힌 환경 — 측정만 빠지고 사이트는 정상 동작한다.
    }
  }, [pathname]);

  return null;
}
