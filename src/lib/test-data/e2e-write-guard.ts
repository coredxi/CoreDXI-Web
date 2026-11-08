/**
 * e2e-write-guard.ts — E2E 쓰기 스펙 실행 여부 판정(순수 함수)
 *
 * [홍보팀] 로컬 E2E는 운영 DB·메일 발송 설정을 그대로 씁니다. 그래서 문의·리드를 만들거나
 * 메일을 보내는 테스트는 기본으로 건너뛰고, 아래 두 가지를 모두 직접 입력했을 때만 실행합니다.
 *   1) E2E_ALLOW_WRITES=1
 *   2) E2E_CONFIRM_DB_HOST=<지금 연결된 DB 호스트> (정확히 같아야 함)
 * 설계: docs/superpowers/specs/2026-11-08-e2e-prod-write-guard-design.md
 */

export const WRITE_GUARD_BLOCKED_MESSAGE =
  "쓰기 E2E는 기본 차단: E2E_ALLOW_WRITES=1 과 E2E_CONFIRM_DB_HOST 확인이 필요합니다";

export type WriteGuardInput = {
  allowWrites: string | undefined;
  confirmHost: string | undefined;
  databaseUrl: string | undefined;
};

export type WriteGuardDecision = { allowed: true } | { allowed: false; reason: string };

/**
 * DATABASE_URL에서 호스트 이름만 꺼낸다. 사용자명·비밀번호는 절대 반환하지 않는다.
 * 파싱할 수 없으면 null.
 */
export function extractDbHost(databaseUrl: string | undefined): string | null {
  if (!databaseUrl || !databaseUrl.trim()) return null;
  try {
    const host = new URL(databaseUrl.trim()).hostname;
    return host || null;
  } catch {
    return null;
  }
}

export function evaluateWriteGuard(input: WriteGuardInput): WriteGuardDecision {
  const host = extractDbHost(input.databaseUrl);
  const hostLabel = `현재 DB 호스트: ${host ?? "알 수 없음"}`;

  if (input.allowWrites !== "1") {
    return { allowed: false, reason: `${WRITE_GUARD_BLOCKED_MESSAGE} (${hostLabel})` };
  }

  const confirm = input.confirmHost?.trim();
  if (!host || !confirm || confirm !== host) {
    return {
      allowed: false,
      reason: `${WRITE_GUARD_BLOCKED_MESSAGE} — E2E_CONFIRM_DB_HOST가 비어 있거나 다릅니다 (${hostLabel})`,
    };
  }

  return { allowed: true };
}
