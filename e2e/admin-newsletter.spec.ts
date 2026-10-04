import { expect, test } from "@playwright/test";
import { loginAsAdmin, skipWithoutAdminCredentials } from "./helpers/admin-auth";

// 실제 네이버 API·구독자 발송은 하지 않는다: 기사는 "직접 추가"로 넣고, 발송은 "검토요청(내게 보내기)"까지만.
// 저장(임시저장 아님)한 캠페인만 기사 추가·검토요청이 가능하다. 호 편집 화면은 수정 없이 바로 미리보기·검토요청한다
// (수정 후엔 "저장"을 먼저 눌러야 미리보기·검토요청·승인·즉시 발송 버튼이 활성화된다).
test.describe("관리자 뉴스레터 골든패스", () => {
  skipWithoutAdminCredentials(test);

  test("캠페인 생성 → 기사 직접 추가 → 미리보기 → 검토요청", async ({ page }) => {
    const name = `[E2E TEST] 뉴스레터 ${Date.now()}`;
    await loginAsAdmin(page);

    await page.goto("/admin/newsletter/campaigns/new");
    await page.getByLabel("뉴스레터 이름").fill(name);
    await page.getByLabel("키워드 1", { exact: true }).fill("AI");
    await page.getByRole("button", { name: "저장", exact: true }).click();
    // /campaigns/new 자체도 [^/]+$에 걸리므로 new는 제외한다
    await page.waitForURL(/\/admin\/newsletter\/campaigns\/(?!new$)[^/]+$/);
    const campaignUrl = page.url();

    await page.getByRole("link", { name: "수집 기사 보기 →" }).click();
    for (const n of [1, 2]) {
      await page.getByLabel("기사 URL").fill(`https://example.com/e2e-${Date.now()}-${n}`);
      await page.getByLabel("기사 제목").fill(`E2E 테스트 기사 ${n}`);
      await page.getByLabel("매체명").fill("E2E매체");
      await page.getByRole("button", { name: "추가", exact: true }).click();
      // 두 번째 반복에서는 첫 번째 토스트가 남아 있을 수 있어 first()
      await expect(page.getByText("기사를 추가하고 이번 호에 선택했습니다.").first()).toBeVisible();
    }

    await page.getByRole("link", { name: "이번 호 편집 →" }).click();
    await page.getByRole("button", { name: "미리보기", exact: true }).click();
    const preview = page.frameLocator('iframe[title="뉴스레터 미리보기"]');
    await expect(preview.getByText("E2E 테스트 기사 1")).toBeVisible();
    await expect(preview.getByText("수신거부")).toBeVisible();

    await page.getByRole("button", { name: "검토요청(내게 보내기)" }).click();
    // RESEND_API_KEY 유무에 따라 성공/설정 안내 중 하나 — 둘 다 "버튼이 서버까지 동작했다"는 증거
    await expect(page.getByText(/검토요청 메일을 보냈습니다|이메일 발송 설정이 완료되지 않았습니다/).first()).toBeVisible();

    // 정리: 자동 수집 대상에서 빼기
    await page.goto(campaignUrl);
    await page.getByRole("button", { name: "미사용 처리" }).click();
    await expect(page.getByRole("button", { name: "사용 재개" })).toBeVisible();
  });
});
