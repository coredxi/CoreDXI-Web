/**
 * campaign-input.ts — 캠페인 만들기/수정 폼 입력 검증(순수 함수)
 * [홍보팀] 캠페인 저장 시 "이름이 비었어요", "키워드를 넣어 주세요" 같은 안내 문구가 여기서 나옵니다.
 */
import { kstYmdToUtc } from "./schedule";
import type { CadenceValue } from "./schedule";
import type { KeywordInput } from "./types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type RuleFormInput = { indicator: string; label: string; description: string; weight: number; isEnabled: boolean };

export type CampaignFormInput = {
  id?: string;
  name: string;
  subjectTemplate: string;
  sendType: "IMMEDIATE" | "SCHEDULED" | "REVIEW_THEN_SEND";
  cadence: CadenceValue;
  sendDayOfWeek: number | null;
  sendHourKst: number;
  activeFrom: string;
  activeUntil: string | null;
  collectDays: number;
  maxArticles: number;
  audience: "subscribers" | "internal";
  internalRecipients: string[];
  keywords: KeywordInput[];
  rules: RuleFormInput[];
  sourceIds: string[];
};

export type NormalizedCampaign = Omit<CampaignFormInput, "activeFrom" | "activeUntil" | "id"> & {
  activeFrom: Date;
  activeUntil: Date | null;
};

type Result = { ok: true; data: NormalizedCampaign } | { ok: false; error: string };

const fail = (error: string): Result => ({ ok: false, error });
const isInt = (n: number, min: number, max: number) => Number.isInteger(n) && n >= min && n <= max;

export function validateCampaignInput(input: CampaignFormInput, opts: { draft: boolean }): Result {
  const name = input.name.trim();
  if (!name) return fail("뉴스레터 이름을 입력해 주세요.");

  const keywords = input.keywords
    .map((k) => ({ ...k, term: k.term.trim(), weight: Math.min(5, Math.max(1, Math.round(k.weight))) }))
    .filter((k) => k.term.length > 0);
  const internalRecipients = input.internalRecipients.map((e) => e.trim().toLowerCase()).filter(Boolean);
  const activeFrom = kstYmdToUtc(input.activeFrom);
  const activeUntil = input.activeUntil ? kstYmdToUtc(input.activeUntil, true) : null;
  const subjectTemplate = input.subjectTemplate.trim();

  if (!opts.draft) {
    if (!subjectTemplate) return fail("메일 제목 템플릿을 입력해 주세요.");
    if (!keywords.some((k) => k.operator !== "NOT")) return fail("포함 키워드를 1개 이상 입력해 주세요.");
    if (input.sendType === "SCHEDULED") {
      return fail("승인 없는 스케줄 자동발송은 2단계에서 활성화됩니다. '검토 후 발송'을 선택해 주세요.");
    }
    if (!isInt(input.sendHourKst, 0, 23)) return fail("발송 시각은 0~23시 사이여야 합니다.");
    if (!isInt(input.collectDays, 1, 31)) return fail("수집기간은 1~31일 사이여야 합니다.");
    if (!isInt(input.maxArticles, 1, 20)) return fail("선별 기사 수는 1~20건 사이여야 합니다.");
    if (input.cadence !== "DAILY" && (input.sendDayOfWeek === null || !isInt(input.sendDayOfWeek, 0, 6))) {
      return fail("발송 요일을 선택해 주세요.");
    }
    if (!activeFrom) return fail("사용기간 시작일이 올바르지 않습니다.");
    if (input.activeUntil && (!activeUntil || activeUntil < activeFrom)) {
      return fail("사용기간 종료일이 올바르지 않습니다.");
    }
    if (input.audience === "internal") {
      if (internalRecipients.length === 0 || internalRecipients.length > 20) {
        return fail("내부 수신자는 1~20명이어야 합니다.");
      }
      if (internalRecipients.some((e) => !EMAIL_PATTERN.test(e))) return fail("내부 수신자 이메일 형식을 확인해 주세요.");
    }
  }

  return {
    ok: true,
    data: {
      ...input,
      name,
      subjectTemplate,
      keywords,
      internalRecipients,
      sourceIds: [...new Set(input.sourceIds)],
      activeFrom: activeFrom ?? kstYmdToUtc(new Date().toISOString().slice(0, 10)) ?? new Date(),
      activeUntil,
    },
  };
}
