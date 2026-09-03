"use server";

import { revalidatePath } from "next/cache";
import { savePageContent } from "@/lib/page-content";
import type { SolutionsContent } from "@/lib/page-content/solutions";

/**
 * [홍보팀] 소개서 다운로드 URL 검증 — "/"로 시작하는 상대 경로 또는 "https://" 절대 URL만
 * 허용한다("javascript:" 등 위험한 스킴, "//" 프로토콜 상대 URL 차단). 빈 문자열은 버튼을
 * 숨기는 용도로 허용한다. src/lib/url-safety.ts의 허용 목록 패턴과 동일한 취지.
 */
function isSafeBrochureUrl(url: string): boolean {
  if (url === "") return true;
  if (url.startsWith("//")) return false;
  if (url.startsWith("/")) return true;
  return url.startsWith("https://");
}

function validate(data: SolutionsContent): string | null {
  if (!data.heroTitleLine1.trim() || !data.heroTitleLine2.trim()) {
    return "히어로 타이틀을 입력해 주세요.";
  }
  if (
    data.solutions.some(
      (s) =>
        !s.title.trim() ||
        !s.desc.trim() ||
        s.features.some((f) => !f.trim())
    )
  ) {
    return "솔루션 카드 3개의 제목·설명·특징을 모두 입력해 주세요.";
  }
  if (data.processSteps.some((s) => !s.title.trim() || !s.desc.trim())) {
    return "도입 프로세스 4단계의 제목·설명을 모두 입력해 주세요.";
  }
  if (!isSafeBrochureUrl(data.brochureUrl.trim())) {
    return "소개서 URL은 '/'로 시작하는 상대 경로 또는 'https://' 절대 URL만 허용됩니다.";
  }
  return null;
}

function normalize(data: SolutionsContent): SolutionsContent {
  return {
    heroBadge: data.heroBadge.trim(),
    heroTitleLine1: data.heroTitleLine1.trim(),
    heroTitleLine2: data.heroTitleLine2.trim(),
    heroSubtitle: data.heroSubtitle.trim(),
    solutionsLabel: data.solutionsLabel.trim(),
    solutionsTitle: data.solutionsTitle.trim(),
    solutions: data.solutions.map((s) => ({
      badge: s.badge.trim(),
      title: s.title.trim(),
      desc: s.desc.trim(),
      features: s.features.map((f) => f.trim()),
    })),
    processLabel: data.processLabel.trim(),
    processTitle: data.processTitle.trim(),
    processDesc: data.processDesc.trim(),
    processSteps: data.processSteps.map((s) => ({
      title: s.title.trim(),
      desc: s.desc.trim(),
    })),
    ctaTitle: data.ctaTitle.trim(),
    ctaDesc: data.ctaDesc.trim(),
    brochureLabel: data.brochureLabel.trim(),
    brochureUrl: data.brochureUrl.trim(),
  };
}

export async function saveSolutionsContent(
  data: SolutionsContent
): Promise<{ success: boolean; message: string }> {
  const error = validate(data);
  if (error) return { success: false, message: error };

  try {
    await savePageContent("solutions", normalize(data));
    revalidatePath("/solutions");
    revalidatePath("/admin/solutions");
    return { success: true, message: "솔루션 페이지가 저장되었습니다." };
  } catch (e) {
    console.error("[saveSolutionsContent]", e);
    return { success: false, message: "저장 중 오류가 발생했습니다." };
  }
}
