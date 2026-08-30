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
  DATA_PREP_STEP_LABEL,
  EFFECT_DISCLAIMER,
  EXPECTED_EFFECT_TONE_SUFFIX,
  GRADE_BASE_SCORE,
  getOptionLabel,
  getQuestionById,
  INDUSTRY_TASK_EXAMPLES,
  NO_AI_EXPERIENCE,
  NO_AI_EXPERIENCE_STEP_LABEL,
  Q3_MAX_SELECT,
  Q5_NEEDS_DATA_PREP,
  SMALL_TEAM_SIZE,
  SMALL_TEAM_STEP_LABEL,
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

export type AxCheckPriority = {
  title: string;
  why: string;
  /** 답변 인용 근거 문장 — "'제안서·견적서 작성'을(를) 가장 시간이 많이 드는 업무로 꼽아주셨습니다." */
  echo: string;
  /** Q1(업종) 기준 구체 예시 1문장. 매핑이 없는 업종("위 복합"/"기타" 등)이면 null. */
  industryExample: string | null;
  /** 미니 로드맵 3단계: [첫 1주, 첫 1개월, 3개월] — Q2·Q4·Q5 분기 접두어가 이미 반영됨. */
  roadmap: readonly [string, string, string];
  expectedEffect: string;
};

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

function buildEcho(taskValue: string, answers: AxCheckAnswers): string {
  const label =
    taskValue === "other" && answers.q3Other?.trim()
      ? answers.q3Other.trim()
      : getOptionLabel(getQuestionById("q3"), taskValue);
  return `'${label}'을(를) 가장 시간이 많이 드는 업무로 꼽아주셨습니다.`;
}

function withPrefixes(base: string, prefixes: string[]): string {
  return prefixes.length > 0 ? `${prefixes.join(" → ")} → ${base}` : base;
}

function buildRoadmap(card: AxCheckTaskCard, answers: AxCheckAnswers): [string, string, string] {
  const week1Prefixes: string[] = [];
  if (NO_AI_EXPERIENCE.has(answers.q4)) week1Prefixes.push(NO_AI_EXPERIENCE_STEP_LABEL);
  if (Q5_NEEDS_DATA_PREP.has(answers.q5)) week1Prefixes.push(DATA_PREP_STEP_LABEL);

  const month1Prefixes: string[] = [];
  if (SMALL_TEAM_SIZE.has(answers.q2)) month1Prefixes.push(SMALL_TEAM_STEP_LABEL);

  return [
    withPrefixes(card.roadmap[0], week1Prefixes),
    withPrefixes(card.roadmap[1], month1Prefixes),
    card.roadmap[2],
  ];
}

function buildPriority(taskValue: string, answers: AxCheckAnswers): AxCheckPriority {
  const card = TASK_CARDS[taskValue] ?? TASK_CARDS.other!;
  const toneSuffix = EXPECTED_EFFECT_TONE_SUFFIX[answers.q6] ?? "";
  const industryExample = INDUSTRY_TASK_EXAMPLES[answers.q1]?.[taskValue] ?? null;

  return {
    title: card.title,
    why: card.why,
    echo: buildEcho(taskValue, answers),
    industryExample,
    roadmap: buildRoadmap(card, answers),
    expectedEffect: `${card.expectedEffect}${toneSuffix}${EFFECT_DISCLAIMER}`,
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
