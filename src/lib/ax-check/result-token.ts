import { randomBytes } from "crypto";

/**
 * AX 체크 결과 재열람 링크(`/ax-check/result/[token]`)용 토큰.
 * newsletter-token.ts와 동일한 패턴 — 이메일과 무관한 추측 불가능한 랜덤 값.
 */
export function generateAxCheckResultToken(): string {
  return randomBytes(24).toString("hex");
}
