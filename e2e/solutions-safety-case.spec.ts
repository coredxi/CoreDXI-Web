import { expect, test } from "@playwright/test";

/**
 * [홍보팀] `/solutions` AX 사례 섹션(Safety-RAG) 골든패스.
 *
 * (1) `/solutions` 방문 → 사례 섹션 제목이 노출된다.
 * (2) 데모 신청 CTA의 href가 `/contact?source=safety_docs`다(집계 키 회귀 방지).
 * (3) PDF 버튼이 있으면 그 href를 직접 요청해 200 + `application/pdf`를 확인한다.
 *     PDF가 아직 게시되지 않은 상태(caseStudyPdfUrl 빈 문자열)라면 버튼 부재를 확인하고
 *     PDF 검사는 건너뛴다.
 */
test("솔루션 페이지 AX 사례 섹션(Safety-RAG) 골든패스", async ({ page, request }) => {
  await page.goto("/solutions");

  const caseStudyHeading = page.getByRole("heading", {
    name: /Safety-RAG/,
  });
  await expect(caseStudyHeading).toBeVisible();

  const demoLink = page.getByRole("link", { name: /데모 신청/ });
  await expect(demoLink).toBeVisible();
  const demoHref = await demoLink.getAttribute("href");
  expect(demoHref).toBe("/contact?source=safety_docs");

  const pdfLink = page.getByRole("link", { name: /사례.*PDF|PDF.*사례/ });
  const pdfLinkCount = await pdfLink.count();
  if (pdfLinkCount > 0) {
    const href = await pdfLink.first().getAttribute("href");
    expect(href).toBeTruthy();
    const response = await request.get(href!);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"] ?? "").toContain("application/pdf");
  }
});
