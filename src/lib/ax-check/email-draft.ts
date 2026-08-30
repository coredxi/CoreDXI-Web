/**
 * email-draft.ts — AX 체크 고객용 이메일 초안 생성 (순수 함수, DB 저장 없음)
 *
 * 저장된 응답(answers·summary)으로부터 매 조회 시점에 이메일 초안을 만든다.
 * 카탈로그(catalog.ts)를 개선하면 아직 발송 전인 리드의 초안도 자동으로 좋아진다.
 * 영업이사가 이 초안을 복사해 검토·수정 후 직접 발송한다(자동 발송 없음).
 *
 * 설계: docs/superpowers/specs/2026-08-30-ax-check-experience-upgrade-design.md 5번
 */

import { getOptionLabel, getQuestionById, SALES_SIGNATURE } from "./catalog";
import type { AxCheckAnswers, AxCheckPriority, AxCheckSummary } from "./summarize";

export type AxCheckEmailDraft = {
  subject: string;
  body: string;
};

function formatPriorityBlock(priority: AxCheckPriority, index: number): string[] {
  return [
    `${index + 1}. ${priority.title}`,
    `   - ${priority.echo}`,
    priority.industryExample ? `   - ${priority.industryExample}` : null,
    `   - ${priority.why}`,
    `   - 첫 1주: ${priority.roadmap[0]}`,
    `   - 첫 1개월: ${priority.roadmap[1]}`,
    `   - 3개월: ${priority.roadmap[2]}`,
    `   - 기대 효과: ${priority.expectedEffect}`,
    "",
  ].filter((line): line is string => line !== null);
}

export function buildCustomerEmailDraft(
  answers: AxCheckAnswers,
  summary: AxCheckSummary,
  contact: { company: string; name: string }
): AxCheckEmailDraft {
  const { company, name } = contact;
  const industryLabel = getOptionLabel(getQuestionById("q1"), answers.q1);

  const priorityLines = summary.priorities.flatMap((p, i) => formatPriorityBlock(p, i));

  const body = [
    `${company} ${name}님, 안녕하세요.`,
    "",
    `AX 체크 진단에 참여해 주셔서 감사합니다. ${industryLabel} 기준으로 정리한 귀사의 AX 우선 과제입니다.`,
    "",
    ...priorityLines,
    "CoreDXI는 진단(2주) → 설계 → 구축 → 교육 순서로 프로젝트를 진행합니다. 반복 업무를 실제로 줄이는 것까지 함께 챙깁니다.",
    "",
    "[[통화에서 말씀 주신 ___ 관련해서는 별도로 안내드리겠습니다.]]",
    "",
    "편하신 시간에 30분 정도 통화하며 자세히 설명드리고 싶습니다. 이 메일에 회신해 주시면 일정을 조율하겠습니다.",
    "",
    SALES_SIGNATURE.name,
    `${SALES_SIGNATURE.title} | CoreDXI`,
    `${SALES_SIGNATURE.phone} | ${SALES_SIGNATURE.email}`,
  ].join("\n");

  return {
    subject: `[CoreDXI] ${company} AX 체크 결과 — 귀사의 우선 과제 ${summary.priorities.length}가지`,
    body,
  };
}
