import { randomBytes } from "crypto";

/**
 * 비밀번호 재설정 링크(`/reset-password/[token]`)용 토큰.
 * newsletter-token.ts·ax-check/result-token.ts와 동일한 패턴 — 이메일과 무관한
 * 추측 불가능한 랜덤 값. URL에 그대로 노출되므로 별도 해시 저장은 하지 않는다
 * (기존 unsubscribeToken·resultToken과 동일한 트레이드오프).
 */
export function generatePasswordResetToken(): string {
  return randomBytes(24).toString("hex");
}

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1시간

export function getPasswordResetExpiresAt(): Date {
  return new Date(Date.now() + PASSWORD_RESET_TTL_MS);
}
