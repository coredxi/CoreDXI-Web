import { expect, test } from "@playwright/test";
import { loginAsAdmin, skipWithoutAdminCredentials } from "./helpers/admin-auth";

test("AX 체크 제출 골든패스", async ({ page }) => {
  const company = `[E2E TEST] AX체크회사 ${Date.now()}`;

  await page.goto("/ax-check?ref=e2e");

  // Q1~Q8: 라디오/체크박스 선택 후 "다음"으로 진행
  await page.getByRole("radio", { name: "네트워크·통신 인프라 구축" }).click();
  await page.getByRole("button", { name: "다음" }).click();

  await page.getByRole("radio", { name: "10~30명" }).click();
  await page.getByRole("button", { name: "다음" }).click();

  await page.getByRole("checkbox", { name: "제안서·견적서 작성" }).click();
  await page
    .getByRole("checkbox", { name: "입찰 공고 탐색·서류 준비(나라장터 등)" })
    .click();
  await page.getByRole("button", { name: "다음" }).click();

  await page
    .getByRole("radio", { name: "직원 일부가 개인적으로 ChatGPT 등 사용" })
    .click();
  await page.getByRole("button", { name: "다음" }).click();

  await page.getByRole("radio", { name: "엑셀·한글 파일(개인 PC·공유폴더)" }).click();
  await page.getByRole("button", { name: "다음" }).click();

  await page.getByRole("radio", { name: "제안·수주 속도" }).click();
  await page.getByRole("button", { name: "다음" }).click();

  await page.getByRole("radio", { name: "3개월 내" }).click();
  await page.getByRole("button", { name: "다음" }).click();

  await page.getByRole("radio", { name: "제가 결정합니다" }).click();
  await page.getByRole("button", { name: "다음" }).click();

  // 마지막 단계: 연락처 + 동의
  await page.getByLabel("회사명").fill(company);
  await page.getByLabel("성함").fill("테스트담당자");
  await page.getByLabel("이메일").fill(`e2e-ax-check-${Date.now()}@example.com`);
  await page
    .getByRole("checkbox", { name: /개인정보 수집·이용에 동의합니다/ })
    .click();

  await page.getByRole("button", { name: "제출하기" }).click();

  await expect(page.getByText("AX 우선 과제 3가지")).toBeVisible({ timeout: 10_000 });
  await expect(
    page.getByText("상세 진단은 입력하신 메일로 보내드렸습니다.")
  ).toBeVisible();

  // 관리자 계정이 없는 환경(E2E_ADMIN_EMAIL 미설정)에서는 여기서 skip한다.
  skipWithoutAdminCredentials(test);

  await loginAsAdmin(page);
  await page.goto("/admin/leads");
  await expect(page.getByText(company)).toBeVisible();
});
