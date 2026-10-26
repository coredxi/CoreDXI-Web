import { expect, test } from "@playwright/test";

/**
 * [홍보팀] 블로그 → 3분 AX 체크 유입 경로(ref) 측정 골든패스.
 * 응답을 제출하지 않으므로 리드 데이터가 생기지 않는다(제출이 필요한 테스트는 ref=internal-test 사용).
 * 설계: docs/superpowers/specs/2026-10-26-blog-attribution-design.md
 */
test("블로그 글 하단 CTA → /ax-check에 ref=blog-{slug} 반영", async ({ page }) => {
  await page.goto("/blog");

  const firstPostLink = page
    .locator('a[href^="/blog/"]:not([href^="/blog/category"])')
    .first();
  const hasPost = (await firstPostLink.count()) > 0;
  test.skip(!hasPost, "발행된 블로그 글이 없어 건너뜁니다.");

  await firstPostLink.click();
  await page.waitForURL(/\/blog\/[^/]+$/);
  const slug = new URL(page.url()).pathname.split("/").pop()!;

  await page.getByRole("link", { name: "3분 AX 체크 시작하기" }).click();
  await page.waitForURL(/\/ax-check\?/);

  const ref = new URL(page.url()).searchParams.get("ref");
  expect(ref).toMatch(/^blog-[a-z0-9-]+$/);
  expect(slug.toLowerCase().startsWith(ref!.slice("blog-".length))).toBe(true);
  await expect(page.locator('input[type="hidden"][name="ref"]')).toHaveValue(ref!);
});

test("영업 링크로 처음 들어온 ref가 ref 없는 /ax-check 방문까지 유지된다", async ({ page }) => {
  await page.goto("/?ref=internal-test");
  // 하이드레이션 후 FirstRefCapture가 탭 저장소에 보관할 때까지 대기
  await page.waitForFunction(
    () => window.sessionStorage.getItem("coredxi:first-ref") === "internal-test"
  );
  await page.goto("/ax-check");

  await expect(page.locator('input[type="hidden"][name="ref"]')).toHaveValue("internal-test");
});
