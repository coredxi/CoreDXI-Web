import type { AxCheckAnswers, AxCheckPriority } from "./summarize";

export type { AxCheckAnswers, AxCheckPriority };

export type LeadGrade = "HOT" | "WARM" | "COLD";
export type LeadStatus = "NEW" | "CONTACTED" | "MEETING" | "CLOSED";

export const LEAD_STATUS_OPTIONS = [
  { value: "NEW", label: "신규" },
  { value: "CONTACTED", label: "연락함" },
  { value: "MEETING", label: "미팅" },
  { value: "CLOSED", label: "종료" },
] as const satisfies ReadonlyArray<{ value: LeadStatus; label: string }>;

export type AxCheckFormInput = {
  refCode?: string;
  company: string;
  name: string;
  email: string;
  phone?: string;
  answers: AxCheckAnswers;
  privacyConsent: boolean;
  marketingOptIn: boolean;
};

export type AxCheckSubmitResult =
  | { success: true; priorities: AxCheckPriority[]; resultToken: string }
  | { success: false; error: string };

/** 관리자 목록/상세용 레코드 — 이메일·전화번호 등 개인정보 포함. */
export type AxCheckLeadRecord = {
  id: string;
  refCode: string | null;
  company: string;
  name: string;
  email: string;
  phone: string | null;
  answers: AxCheckAnswers;
  catalogVersion: string;
  grade: LeadGrade;
  score: number;
  priorities: AxCheckPriority[];
  status: LeadStatus;
  note: string | null;
  marketingOptIn: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type AxCheckListResult =
  | { success: true; leads: AxCheckLeadRecord[] }
  | { success: false; error: string };

export type UpdateAxCheckStatusResult =
  | { success: true }
  | { success: false; error: string };

export type UpdateAxCheckNoteResult =
  | { success: true }
  | { success: false; error: string };

export type DeleteAxCheckResult =
  | { success: true }
  | { success: false; error: string };

/** /ax-check/result/[token] — 등급·이메일·전화번호 등 내부용 필드는 제외한 공개 조회 결과. */
export type AxCheckResultPageData = {
  company: string;
  priorities: AxCheckPriority[];
};

export type AxCheckResultLookupResult =
  | { success: true; data: AxCheckResultPageData }
  | { success: false; error: string };
