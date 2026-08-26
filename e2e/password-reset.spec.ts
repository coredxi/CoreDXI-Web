import { config } from "dotenv";
config({ path: ".env" });

import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { expect, test } from "@playwright/test";
import { prisma } from "../src/lib/prisma";

// 이 골든패스는 이메일을 실제로 열어볼 수 없으므로, 발송된 토큰을 DB에서 직접 조회해
// 링크를 클릭한 것처럼 재현한다. 실제 계정에 영향을 주지 않도록 전용 테스트 User를
// 만들고 끝나면 정리한다(공유 E2E_ADMIN 계정의 비밀번호를 바꾸면 다른 e2e가 깨진다).
test.describe("비밀번호 재설정 (이메일 링크) 골든패스", () => {
  const testEmail = `e2e-password-reset-${Date.now()}@example.com`;
  let userId: string;

  test.beforeAll(async () => {
    const placeholderHash = await bcrypt.hash(randomUUID(), 10);
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        name: "E2E 테스트 사용자",
        password: placeholderHash,
        emailVerified: new Date(),
      },
    });
    userId = user.id;
  });

  test.afterAll(async () => {
    await prisma.passwordResetToken.deleteMany({ where: { email: testEmail } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.$disconnect();
  });

  test("요청 → 토큰 발급 → 재설정 → 새 비밀번호로 로그인", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("이메일").fill(testEmail);
    await page.getByRole("button", { name: "재설정 링크 보내기" }).click();
    await expect(page.getByText("메일을 확인해 주세요")).toBeVisible({ timeout: 10_000 });

    const tokenRecord = await prisma.passwordResetToken.findFirst({
      where: { email: testEmail },
      orderBy: { createdAt: "desc" },
    });
    expect(tokenRecord).not.toBeNull();

    const newPassword = "e2e-new-password-123";
    await page.goto(`/reset-password/${tokenRecord!.token}`);
    await expect(page.getByRole("heading", { name: "새 비밀번호 설정" })).toBeVisible();

    await page.getByLabel("새 비밀번호").fill(newPassword);
    await page.getByRole("button", { name: "비밀번호 변경" }).click();

    await expect(page.getByText("비밀번호가 변경되었습니다")).toBeVisible();
    await page.getByRole("link", { name: "로그인하러 가기" }).click();
    await expect(page).toHaveURL(/\/login/);

    // 새 비밀번호로 실제 로그인까지 확인한다.
    await page.getByRole("button", { name: "로그인" }).click(); // 이메일 로그인 폼 토글
    await page.getByLabel("이메일").fill(testEmail);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("비밀번호").fill(newPassword);
    await page.getByRole("button", { name: "로그인", exact: true }).last().click();

    await expect(page).toHaveURL("/");
    await expect(page.getByText("E2E 테스트 사용자")).toBeVisible();
  });

  test("만료·존재하지 않는 토큰은 에러 화면을 보여준다", async ({ page }) => {
    await page.goto("/reset-password/this-token-does-not-exist");
    await expect(page.getByText("유효하지 않은 링크입니다.")).toBeVisible();
    await page.getByRole("link", { name: "비밀번호 재설정 다시 요청하기" }).click();
    await expect(page).toHaveURL(/\/forgot-password/);
  });
});
