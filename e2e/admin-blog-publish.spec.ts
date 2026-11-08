import { expect, test } from "@playwright/test";
import { loginAsAdmin, skipWithoutAdminCredentials } from "./helpers/admin-auth";
import { skipUnlessWritesAllowed } from "./helpers/write-guard";

test("블로그 작성·발행 골든패스", async ({ page }) => {
  skipUnlessWritesAllowed(test);
  skipWithoutAdminCredentials(test);

  await loginAsAdmin(page);

  await page.goto("/admin/blog/new");

  const title = `[E2E TEST] Playwright 골든패스 ${Date.now()}`;
  await page.getByLabel("제목").fill(title);
  await page.getByRole("button", { name: "발행하기" }).click();

  await expect(page.getByText("발행되었습니다.")).toBeVisible({
    timeout: 10_000,
  });
  await expect(page).toHaveURL(/\/admin\/blog\/.+\/edit/);
});
