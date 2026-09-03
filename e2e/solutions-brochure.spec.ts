import { expect, test } from "@playwright/test";

/**
 * [홍보팀] `/solutions` AX 컨설팅 카드의 "소개서 PDF 다운로드" 버튼 골든패스.
 *
 * (1) `/solutions` 방문 → 소개서 버튼이 존재하고 유효한 href를 가진다.
 * (2) 그 href를 직접 요청하면 200을 응답하고, Content-Type이 PDF다.
 * `SolutionsContent`가 DB에 없으면(첫 배포 직후 등) `SOLUTIONS_CONTENT_DEFAULTS`가
 * 쓰이므로, 관리자 페이지 설정 여부와 무관하게 항상 성립하는 계약이다.
 */
test("솔루션 페이지 소개서 다운로드 골든패스", async ({ page, request }) => {
  await page.goto("/solutions");

  const brochureLink = page.getByRole("link", { name: /소개서/ });
  await expect(brochureLink).toBeVisible();

  const href = await brochureLink.getAttribute("href");
  expect(href).toBeTruthy();

  const response = await request.get(href!);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"] ?? "").toContain("application/pdf");
});
