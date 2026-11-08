/**
 * subject.ts — 뉴스레터 메일 제목 생성
 * [홍보팀] 제목 템플릿의 {{issueDate}}(발행일)·{{issueNo}}(회차)를 실제 값으로 바꿉니다.
 * 광고성 정보 표기(정보통신망법 §50) 때문에 발송 직전 항상 "(광고)"를 맨 앞에 강제합니다.
 */
import { formatKstYmd } from "./schedule";

export const AD_PREFIX = "(광고)";

export function renderSubjectTemplate(
  template: string,
  vars: { issueNo: number; issueDate: Date }
): string {
  return template
    .replaceAll("{{issueDate}}", formatKstYmd(vars.issueDate))
    .replaceAll("{{issueNo}}", String(vars.issueNo))
    .trim();
}

export function ensureAdPrefix(subject: string): string {
  const withoutPrefix = subject.replace(/\(광고\)\s*/g, "").trim();
  return `${AD_PREFIX} ${withoutPrefix}`;
}
