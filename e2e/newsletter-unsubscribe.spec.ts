import { expect, test } from "@playwright/test";

/**
 * [홍보팀] 뉴스레터 수신거부 골든패스(2026-10-20 개정 흐름).
 * 링크를 여는 것만으로는 해지되지 않고, 잘못된 링크는 안내 화면을 보여준다.
 * 원클릭 주소(/api/newsletter/unsubscribe/{token})는 GET이면 확인 화면으로 303 이동,
 * 본문 없는 POST는 400, 잘못된 토큰 POST는 404를 돌려준다. 실제 구독자 토큰은 쓰지 않는다.
 */
const INVALID_TOKEN = "e2e-invalid-token";

test("잘못된 수신거부 링크는 안내 화면을 보여준다", async ({ page }) => {
  await page.goto(`/unsubscribe/${INVALID_TOKEN}`);
  await expect(
    page.getByRole("heading", { name: "구독 해지 링크를 확인할 수 없습니다" })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "구독 해지" })).toHaveCount(0);
});

test("원클릭 수신거부 주소는 POST 본문이 맞을 때만 처리한다", async ({ request }) => {
  const path = `/api/newsletter/unsubscribe/${INVALID_TOKEN}`;

  const get = await request.get(path, { maxRedirects: 0 });
  expect(get.status()).toBe(303);
  expect(get.headers()["location"]).toContain(`/unsubscribe/${INVALID_TOKEN}`);

  const noBody = await request.post(path);
  expect(noBody.status()).toBe(400);

  const oneClick = await request.post(path, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    data: "List-Unsubscribe=One-Click",
  });
  expect(oneClick.status()).toBe(404);
});
