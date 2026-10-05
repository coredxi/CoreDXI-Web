/**
 * audience.ts — 캠페인 수신 대상(구독자/내부)에 맞는 안내 문구
 * [홍보팀] "즉시 발송" 확인창이 실제로 누구에게 나가는지 정확히 보여주도록 하는 부분입니다.
 */

export function sendNowConfirmMessage(audience: string, internalCount: number): string {
  if (audience === "internal") return `지금 내부 수신자 ${internalCount}명에게 발송합니다. 계속할까요?`;
  return "지금 구독자 전원에게 실제 발송합니다. 되돌릴 수 없습니다. 계속할까요?";
}
