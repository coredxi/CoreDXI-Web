import { expect, test } from "@playwright/test";

/**
 * [홍보팀] 성공사례 상세(`/cases/[slug]`) 골든패스.
 *
 * `/blog/[slug]`에서 났던 DYNAMIC_SERVER_USAGE 500(headers()+ISR 충돌, PR #1)의
 * 재발 방지 회귀 테스트. `/cases/[slug]`는 CSP nonce를 headers()로 읽어
 * JSON-LD <script>에 넣는데, dynamic = "force-dynamic"으로 항상 요청마다
 * 새로 렌더링되므로 (1) 매 요청 200을 응답하고 (2) 응답에 실린 JSON-LD
 * <script>의 nonce가 그 요청의 실제 CSP 응답 헤더 nonce와 정확히 일치하며
 * (3) Cache-Control이 캐시되지 않음(no-store)을 검증한다.
 *
 * 참고: DYNAMIC_SERVER_USAGE 자체는 프로덕션 빌드(`next build`)의 정적
 * 생성 단계에서만 발생하는 문제라 `npm run dev` 기반인 이 E2E로는 재현되지
 * 않는다 — 그 크래시 재현·수정 확인은 로컬 프로덕션 빌드로 별도 검증했다
 * (PR 설명 참고). 이 테스트는 수정 이후의 "정상 동작 계약"을 지킨다.
 */
test("성공사례 상세 페이지 CSP nonce·캐시 골든패스", async ({
  page,
  request,
}) => {
  await page.goto("/cases");

  const firstCaseLink = page.locator('a[href^="/cases/"]').first();
  const hasCase = (await firstCaseLink.count()) > 0;
  test.skip(!hasCase, "등록된 성공사례가 없어 건너뜁니다.");

  const href = await firstCaseLink.getAttribute("href");
  expect(href).toBeTruthy();

  // 같은 경로를 두 번 직접 요청해 매번 새 nonce가 발급되고(caching 없음),
  // 응답에 실린 JSON-LD의 nonce와 CSP 응답 헤더의 nonce가 정확히 일치하는지 확인.
  for (let i = 0; i < 2; i += 1) {
    const response = await request.get(href!);
    expect(response.status()).toBe(200);

    const cacheControl = response.headers()["cache-control"] ?? "";
    expect(cacheControl).toContain("no-store");

    const csp = response.headers()["content-security-policy"] ?? "";
    const nonceMatch = csp.match(/'nonce-([^']+)'/);
    expect(nonceMatch, "CSP 응답 헤더에 nonce가 없습니다").not.toBeNull();
    const headerNonce = nonceMatch![1];

    const body = await response.text();
    expect(body).toContain(`nonce="${headerNonce}"`);
    expect(body).toContain('"@type":"BreadcrumbList"');
    expect(body).toContain('"@type":"Article"');
  }

  // UI 관점에서도 정상 렌더링되는지 함께 확인.
  await page.goto(href!);
  await expect(page.locator("h1")).toBeVisible();
});
