import { randomBytes } from "crypto";

/**
 * 뉴스레터 구독 해지 링크(`/unsubscribe/[token]`)용 토큰.
 * 이메일과 무관한 추측 불가능한 랜덤 값 — URL에 이메일이 직접 노출되지 않는다.
 */
export function generateUnsubscribeToken(): string {
  return randomBytes(24).toString("hex");
}
