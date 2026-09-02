/**
 * email-draft.ts — AX 체크 고객용 이메일 초안 생성 (순수 함수, DB 저장 없음)
 *
 * buildCustomerEmailDraft: T1(상세 진단) 본문. mode:"manual"(기본)은 관리자 미리보기용 —
 * 사람이 통화에서 들은 내용을 채워 넣을 편집 슬롯([[ ]])을 남긴다. mode:"auto"는
 * 자동 발송(followup.ts)이 실제로 쓰는 버전 — 편집 슬롯을 제거하고 안 1 여는 말/맺는 말을 쓴다.
 * buildT0Email: T0(제출 즉시 요약) 본문 — 항상 자동 발송 전용, mode 구분 없음.
 *
 * 저장된 응답(answers·summary)으로부터 매 조회/발송 시점에 초안을 새로 만든다.
 * catalog.ts(FOLLOWUP_COPY)를 개선하면 아직 발송 전인 리드의 메일도 자동으로 좋아진다.
 *
 * 설계: docs/superpowers/specs/2026-09-02-ax-check-auto-followup-design.md 8번
 */

import {
  FOLLOWUP_COPY,
  getOptionLabel,
  getQuestionById,
  renderSignatureBlock,
} from "./catalog";
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
  contact: { company: string; name: string },
  opts?: { mode?: "manual" | "auto" }
): AxCheckEmailDraft {
  const mode = opts?.mode ?? "manual";
  const { company, name } = contact;
  const industryLabel = getOptionLabel(getQuestionById("q1"), answers.q1);
  const priorityLines = summary.priorities.flatMap((p, i) => formatPriorityBlock(p, i));
  const count = summary.priorities.length;

  if (mode === "auto") {
    const body = [
      FOLLOWUP_COPY.t1.greeting(company, name),
      "",
      FOLLOWUP_COPY.t1.introLine(industryLabel, count),
      FOLLOWUP_COPY.t1.introLine2,
      "",
      ...priorityLines,
      FOLLOWUP_COPY.t1.processParagraph,
      "",
      FOLLOWUP_COPY.t1.callToAction(company),
      "",
      FOLLOWUP_COPY.optOutNotice,
      "",
      renderSignatureBlock(),
    ].join("\n");

    return { subject: FOLLOWUP_COPY.t1.subject(company, count), body };
  }

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
    renderSignatureBlock(),
  ].join("\n");

  return {
    subject: `[CoreDXI] ${company} AX 체크 결과 — 귀사의 우선 과제 ${count}가지`,
    body,
  };
}

export function buildT0Email(
  summary: { priorities: AxCheckPriority[] },
  contact: { company: string; name: string },
  links: { resultUrl: string; brochureUrl?: string }
): AxCheckEmailDraft {
  const { company, name } = contact;
  const count = summary.priorities.length;
  const priorityLines = summary.priorities.map((p, i) => `  ${i + 1}. ${p.title}`);

  const bodyLines: string[] = [
    FOLLOWUP_COPY.t0.greeting(company, name),
    "",
    FOLLOWUP_COPY.t0.introLine1(company, count),
    FOLLOWUP_COPY.t0.introLine2,
    "",
    ...priorityLines,
    "",
    `결과 다시 보기: ${links.resultUrl}`,
  ];

  if (links.brochureUrl) {
    bodyLines.push(`CoreDXI AX 전환 컨설팅 소개서: ${links.brochureUrl}`);
  }

  bodyLines.push(
    "",
    FOLLOWUP_COPY.t0.followupNotice,
    "",
    FOLLOWUP_COPY.optOutNotice,
    "",
    renderSignatureBlock()
  );

  return {
    subject: FOLLOWUP_COPY.t0.subject(company, count),
    body: bodyLines.join("\n"),
  };
}
