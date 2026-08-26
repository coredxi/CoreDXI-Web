import { config } from "dotenv";
config({ path: ".env" });

import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { expect, test } from "@playwright/test";
import { SUPABASE_CA_CERT } from "../src/lib/supabase-ca";

// Prisma 7 생성 클라이언트가 import.meta(ESM 전용 문법)를 쓰기 때문에 Playwright의
// 테스트 프로세스(CJS 변환)에서 "@/lib/prisma"를 직접 import할 수 없다. 대신 이미
// 의존성으로 있는 pg를 prisma.ts와 동일한 접속 설정(SUPABASE_CA_CERT)으로 그대로 써서
// 이메일을 열어볼 수 없는 상황에서 발급된 토큰을 DB에서 직접 조회한다.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { ca: SUPABASE_CA_CERT, rejectUnauthorized: true },
});

// 이 골든패스는 이메일을 실제로 열어볼 수 없으므로, 발송된 토큰을 DB에서 직접 조회해
// 링크를 클릭한 것처럼 재현한다. 실제 계정에 영향을 주지 않도록 전용 테스트 User를
// 만들고 끝나면 정리한다(공유 E2E_ADMIN 계정의 비밀번호를 바꾸면 다른 e2e가 깨진다).
test.describe("비밀번호 재설정 (이메일 링크) 골든패스", () => {
  // 두 테스트가 동시에 뜨면 개발 서버(Turbopack)가 같은 라우트를 동시에 첫 컴파일하며
  // 지연이 생겨 assertion이 간헐적으로 타임아웃한다. 순차 실행으로 고정한다.
  test.describe.configure({ mode: "serial" });

  // Resend가 example.com 등 예약 도메인으로의 발송은 API 단에서 거부하므로
  // (실제 배달 여부와 무관하게 이 요청은 실패로 응답), 실제로 발송 가능한
  // coredxi.com 도메인의 존재하지 않는 로컬파트를 사용한다.
  const testEmail = `e2e-password-reset-${Date.now()}@coredxi.com`;
  const userId = randomUUID();

  test.beforeAll(async () => {
    // 로컬 반복 실행 시 요청 단계 rate limit(IP당 1시간 5회)에 걸리지 않도록,
    // 이 기능의 IP 기반 키만 초기화한다(다른 기능의 rate limit에는 영향 없음).
    await pool.query(`DELETE FROM "RateLimitHit" WHERE key LIKE 'password-reset-request-ip:%'`);

    const placeholderHash = await bcrypt.hash(randomUUID(), 10);
    await pool.query(
      `INSERT INTO "User" (id, email, name, password, "emailVerified", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, NOW(), NOW(), NOW())`,
      [userId, testEmail, "E2E 테스트 사용자", placeholderHash]
    );
  });

  test.afterAll(async () => {
    await pool.query(`DELETE FROM "PasswordResetToken" WHERE email = $1`, [testEmail]);
    await pool.query(`DELETE FROM "User" WHERE id = $1`, [userId]);
    await pool.end();
  });

  test("요청 → 토큰 발급 → 재설정 → 새 비밀번호로 로그인", async ({ page }) => {
    test.setTimeout(60_000); // 여러 단계를 이어가는 골든패스라 기본 30초보다 여유를 둔다.
    await page.goto("/forgot-password");
    await page.getByLabel("이메일").fill(testEmail);
    await page.getByRole("button", { name: "재설정 링크 보내기" }).click();
    await expect(page.getByText("메일을 확인해 주세요")).toBeVisible({ timeout: 10_000 });

    const { rows } = await pool.query<{ token: string }>(
      `SELECT token FROM "PasswordResetToken" WHERE email = $1 ORDER BY "createdAt" DESC LIMIT 1`,
      [testEmail]
    );
    expect(rows).toHaveLength(1);
    const token = rows[0]!.token;

    const newPassword = "e2e-new-password-123";
    await page.goto(`/reset-password/${token}`);
    await expect(page.getByRole("heading", { name: "새 비밀번호 설정" })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByLabel("새 비밀번호").fill(newPassword);
    await page.getByRole("button", { name: "비밀번호 변경" }).click();

    await expect(page.getByText("비밀번호가 변경되었습니다")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("link", { name: "로그인하러 가기" }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });

    // 새 비밀번호로 실제 로그인까지 확인한다.
    await page.getByRole("button", { name: "로그인", exact: true }).click(); // 이메일 로그인 폼 토글
    await page.getByLabel("이메일").fill(testEmail);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("비밀번호", { exact: true }).fill(newPassword);
    await page.getByRole("button", { name: "로그인", exact: true }).last().click();

    await expect(page).toHaveURL("/", { timeout: 15_000 });
    await expect(page.getByText("E2E 테스트 사용자").first()).toBeVisible({ timeout: 15_000 });
  });

  test("만료·존재하지 않는 토큰은 에러 화면을 보여준다", async ({ page }) => {
    await page.goto("/reset-password/this-token-does-not-exist");
    await expect(page.getByText("유효하지 않은 링크입니다.")).toBeVisible();
    await page.getByRole("link", { name: "비밀번호 재설정 다시 요청하기" }).click();
    await expect(page).toHaveURL(/\/forgot-password/, { timeout: 10_000 });
  });
});
