import { expect, test } from "@playwright/test";

/**
 * [홍보팀] 소셜 공유(카카오톡·X·페이스북 등)에 필요한 메타태그 골든패스.
 * 실제 발행된 글의 <head>에 og:title/og:image/twitter:card가 존재하고,
 * og:image가 가리키는 URL이 실제로 image/png를 200으로 응답하는지 확인한다.
 */
test("블로그 상세 페이지 소셜 메타 골든패스", async ({ page, request }) => {
  await page.goto("/blog");

  const firstPostLink = page
    .locator('a[href^="/blog/"]:not([href^="/blog/category"])')
    .first();

  const hasPost = (await firstPostLink.count()) > 0;
  test.skip(!hasPost, "발행된 블로그 글이 없어 건너뜁니다.");

  await firstPostLink.click();
  await page.waitForURL(/\/blog\/[^/]+$/);

  const ogTitle = page.locator('meta[property="og:title"]');
  const ogImage = page.locator('meta[property="og:image"]');
  const twitterCard = page.locator('meta[name="twitter:card"]');

  await expect(ogTitle).toHaveAttribute("content", /.+/);
  await expect(twitterCard).toHaveAttribute("content", "summary_large_image");

  const ogImageUrl = await ogImage.getAttribute("content");
  expect(ogImageUrl).toBeTruthy();

  const imageResponse = await request.get(ogImageUrl!);
  expect(imageResponse.status()).toBe(200);
  expect(imageResponse.headers()["content-type"]).toContain("image/png");
});
