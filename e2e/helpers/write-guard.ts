import fs from "node:fs";
import path from "node:path";
import { parse } from "dotenv";
import type { TestType } from "@playwright/test";
import { evaluateWriteGuard } from "../../src/lib/test-data/e2e-write-guard";

/**
 * [홍보팀] 운영 DB 보호 장치. 로컬 E2E가 띄우는 dev 서버는 .env의 운영 DB·메일 설정을 그대로 쓰므로,
 * 문의·리드 생성이나 메일 발송이 일어나는 "쓰기" 테스트는 기본으로 건너뜁니다.
 * 꼭 실행해야 하면 E2E_ALLOW_WRITES=1 과 E2E_CONFIRM_DB_HOST=<DB 호스트>를 함께 주세요.
 * 끝나면 관리자 화면(/admin/contact, /admin/leads)의 "테스트 데이터 정리"로 지웁니다.
 */

/** dev 서버(Next)가 읽는 순서대로 DATABASE_URL을 찾는다: .env.local → .env → 현재 셸 환경변수. */
function readDatabaseUrl(): string | undefined {
  for (const file of [".env.local", ".env"]) {
    const fullPath = path.join(process.cwd(), file);
    if (!fs.existsSync(fullPath)) continue;
    const value = parse(fs.readFileSync(fullPath)).DATABASE_URL;
    if (value) return value;
  }
  return process.env.DATABASE_URL;
}

export function skipUnlessWritesAllowed(test: TestType<object, object>) {
  const decision = evaluateWriteGuard({
    allowWrites: process.env.E2E_ALLOW_WRITES,
    confirmHost: process.env.E2E_CONFIRM_DB_HOST,
    databaseUrl: readDatabaseUrl(),
  });
  test.skip(!decision.allowed, decision.allowed ? "" : decision.reason);
}
