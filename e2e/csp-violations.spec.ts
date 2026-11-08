import { expect, test } from "@playwright/test";

/**
 * [홍보팀] 페이지를 열었을 때 보안 정책(CSP) 위반으로 막히는 요청이 없는지 확인한다.
 * 2026-10-26 GA4 방문 비콘(www.google.com/g/collect)이 connect-src에 막혀 방문자 집계가
 * 누락되던 문제의 회귀 방지용. 개발 서버(next dev)만 쓰는 eval 위반은 운영과 무관해 제외한다.
 */
const PAGES = ["/", "/blog", "/ax-check"];

for (const path of PAGES) {
  test(`CSP 위반 콘솔 오류 0건 — ${path}`, async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (message) => {
      const text = message.text();
      if (!/Content Security Policy/i.test(text)) return;
      if (/unsafe-eval/i.test(text)) return;
      violations.push(text.slice(0, 300));
    });

    await page.goto(path);
    await page.mouse.wheel(0, 3000);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);
    // GA4는 페이지를 떠날 때 user_engagement 비콘을 www.google.com/g/collect로도 보낸다 —
    // 다른 페이지로 이동해야 이 요청이 발생하므로 이동 후 잠시 대기한다.
    await page.goto("/privacy");
    await page.waitForTimeout(2000);

    expect(violations).toEqual([]);
  });
}
