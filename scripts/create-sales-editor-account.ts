/**
 * create-sales-editor-account.ts — 영업이사 EDITOR 관리자 계정 1회성 생성 스크립트
 *
 * Phase 1.5 영업 지원 트랙 액션플랜 0-5. `/admin/register`(createAdmin 서버 액션)는
 * 비밀번호를 placeholder로만 만들고 별도 재설정 경로가 없어(admin.actions.ts 참고),
 * 이 스크립트는 실제 로그인 가능한 임시 비밀번호를 직접 생성해 콘솔에 한 번만 출력한다.
 * 비밀번호 해시 방식은 src/app/api/auth/register/route.ts와 동일(bcryptjs, 10 rounds).
 *
 * 이미 같은 이메일의 Admin이 있으면 아무것도 하지 않고 안내만 출력하므로 재실행해도 안전하다.
 * 출력되는 임시 비밀번호는 로그 파일·커밋에 남기지 말고 별도 채널로만 전달할 것.
 *
 * 실행: npx tsx scripts/create-sales-editor-account.ts
 */
import { config } from "dotenv";
import { randomBytes } from "crypto";

config({ path: ".env" });

const SALES_EDITOR_EMAIL = "obaamg1017@coredxi.com";
const SALES_EDITOR_NAME = "영업이사";
const BCRYPT_ROUNDS = 10;

function generateTempPassword(): string {
  // 12바이트 → base64url 16자. 대/소문자·숫자·기호가 섞여 있어 별도 규칙 없이도 충분히 안전하다.
  return randomBytes(12).toString("base64url");
}

async function main() {
  const bcrypt = (await import("bcryptjs")).default;
  const { prisma } = await import("../src/lib/prisma");

  const existing = await prisma.admin.findUnique({
    where: { email: SALES_EDITOR_EMAIL },
  });

  if (existing) {
    console.log(
      `이미 존재하는 관리자 계정입니다 (${SALES_EDITOR_EMAIL}, role: ${existing.role}) — 아무 작업도 하지 않고 종료합니다.`
    );
    await prisma.$disconnect();
    return;
  }

  const tempPassword = generateTempPassword();
  const hashed = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);

  await prisma.admin.create({
    data: {
      email: SALES_EDITOR_EMAIL,
      name: SALES_EDITOR_NAME,
      role: "EDITOR",
      password: hashed,
    },
  });

  console.log(`계정 생성 완료: ${SALES_EDITOR_EMAIL} (role: EDITOR)`);
  console.log(`생성된 임시 비밀번호: ${tempPassword}`);
  console.log(
    "⚠️ 이 비밀번호는 이 실행 결과에서만 확인할 수 있습니다. 커밋·로그 파일에 남기지 말고, 영업이사님께는 별도 채널(예: 문자·직접 전달)로만 전달하세요."
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
