/**
 * summarize.ts — AX 체크 1단계 규칙 기반 요약 (순수 함수, LLM 없음)
 *
 * 응답 즉시(수백 ms) 우선 과제 최대 3개 + 리드 등급(HOT/WARM/COLD)을 계산한다.
 * 2단계(응답 20건 누적 후)에서 LLM 상세 진단서를 붙이기 전까지는 이 함수만으로
 * 화면 요약·메일 상세본을 모두 만든다.
 *
 * 설계: docs/superpowers/specs/2026-08-22-sales-funnel-ax-check-design.md 5번
 */

import {
  AUTHORITY_DECISIVE,
  CATALOG_VERSION,
  DATA_PREP_PREFIX,
  EXPECTED_EFFECT_TONE_SUFFIX,
  GRADE_BASE_SCORE,
  Q3_MAX_SELECT,
  Q5_NEEDS_DATA_PREP,
  TASK_CARDS,
  TIMING_CONSIDERING,
  TIMING_NEAR_TERM,
  type AxCheckTaskCard,
  type CatalogLeadGrade,
} from "./catalog";

export type AxCheckAnswers = {
  q1: string;
  q2: string;
  /** 최대 3개 선택 (Q3_MAX_SELECT) */
  q3: string[];
  q3Other?: string;
  q4: string;
  q5: string;
  q6: string;
  q7: string;
  q8: string;
};

export type AxCheckPriority = AxCheckTaskCard;

export type AxCheckSummary = {
  priorities: AxCheckPriority[];
  grade: CatalogLeadGrade;
  score: number;
  catalogVersion: string;
};

/** Q7·Q8·Q3 선택 개수로 리드 등급을 판정한다 (설계 3번 "리드 등급 규칙(v1)"). */
export function gradeAxCheck(answers: Pick<AxCheckAnswers, "q3" | "q7" | "q8">): CatalogLeadGrade {
  const selectedCount = answers.q3.length;

  const isHot =
    TIMING_NEAR_TERM.has(answers.q7) && AUTHORITY_DECISIVE.has(answers.q8) && selectedCount >= 2;
  if (isHot) return "HOT";

  const isWarm = TIMING_CONSIDERING.has(answers.q7);
  if (isWarm) return "WARM";

  return "COLD";
}

function computeScore(grade: CatalogLeadGrade, selectedCount: number): number {
  return GRADE_BASE_SCORE[grade] + Math.min(selectedCount, Q3_MAX_SELECT) * 10;
}

function buildPriority(taskValue: string, answers: AxCheckAnswers): AxCheckPriority {
  const card = TASK_CARDS[taskValue] ?? TASK_CARDS.other!;
  const needsDataPrep = Q5_NEEDS_DATA_PREP.has(answers.q5);
  const toneSuffix = EXPECTED_EFFECT_TONE_SUFFIX[answers.q6] ?? "";

  return {
    title: card.title,
    why: card.why,
    firstStep: needsDataPrep ? `${DATA_PREP_PREFIX}${card.firstStep}` : card.firstStep,
    expectedEffect: `${card.expectedEffect}${toneSuffix}`,
  };
}

/**
 * answers → 우선 과제 최대 3개 + 등급 + 점수.
 * Q3에서 고른 업무(최대 3개)마다 과제 카드를 매핑하고, Q5가 "흩어져 있음/잘 모름"이면
 * 모든 카드의 firstStep 앞에 "데이터 정리 1주"를 붙인다. Q6에 따라 expectedEffect 톤을 맞춘다.
 */
export function summarizeAxCheck(answers: AxCheckAnswers): AxCheckSummary {
  const selectedTasks = answers.q3.slice(0, Q3_MAX_SELECT);
  const priorities = selectedTasks.map((taskValue) => buildPriority(taskValue, answers));

  const grade = gradeAxCheck(answers);
  const score = computeScore(grade, selectedTasks.length);

  return { priorities, grade, score, catalogVersion: CATALOG_VERSION };
}
