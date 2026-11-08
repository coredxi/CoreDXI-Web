import { expect, test } from "@playwright/test";
import { skipUnlessWritesAllowed } from "./helpers/write-guard";

test("문의 제출 골든패스", async ({ page }) => {
  skipUnlessWritesAllowed(test);
  await page.goto("/contact");

  await page.getByLabel("이름 (First Name)").fill("길동");
  await page.getByLabel("성 (Last Name)").fill("홍");
  await page.getByLabel("업무용 이메일").fill(`e2e-${Date.now()}@example.com`);

  await page.getByLabel("문의 유형").click();
  await page.getByRole("option", { name: "기능 및 기술 관련 문의" }).click();

  await page
    .getByLabel("어떻게 도와드릴까요?")
    .fill("[E2E TEST] Playwright 골든패스 자동 테스트 문의입니다.");

  const dialogPromise = page.waitForEvent("dialog");
  await page.getByRole("button", { name: "제출하기" }).click();
  const dialog = await dialogPromise;
  expect(dialog.message()).toContain("성공적으로 접수되었습니다");
  await dialog.accept();

  // 제출 성공 후 폼이 초기화된다
  await expect(page.getByLabel("이름 (First Name)")).toHaveValue("");
});
