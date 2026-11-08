/**
 * cleanup-criteria.ts — 관리자 "테스트 데이터 정리" 대상 판정(순수 함수)
 *
 * [홍보팀] 자동 테스트(E2E)가 남긴 문의·AX 체크 리드만 골라내는 규칙입니다.
 * 실제 고객 데이터가 섞이지 않도록 두 조건을 "모두" 만족할 때만 대상으로 봅니다.
 *   - 문의: 이메일이 e2e-…@example.com 이고, 내용에 [E2E TEST]가 들어 있음
 *   - 리드: ref가 e2e 이고, 회사명이 [E2E TEST]로 시작함
 * 설계: docs/superpowers/specs/2026-11-08-e2e-prod-write-guard-design.md
 */

export const E2E_TEST_MARKER = "[E2E TEST]";
export const E2E_CONTACT_EMAIL_PREFIX = "e2e-";
export const E2E_CONTACT_EMAIL_DOMAIN = "@example.com";
export const E2E_LEAD_REF = "e2e";

/** 미리보기 대화상자에 보여 줄 최대 건수. */
export const CLEANUP_PREVIEW_SAMPLE_SIZE = 5;

export type CleanupTarget = "contacts" | "leads";

export type TestDataSample = {
  id: string;
  label: string;
  createdAt: string;
};

export type TestDataPreview = {
  total: number;
  samples: TestDataSample[];
};

export type TestDataPreviewResult =
  | { success: true; preview: TestDataPreview }
  | { success: false; error: string };

export type TestDataCleanupResult =
  | { success: true; deletedIds: string[] }
  | { success: false; error: string };

export function isE2eTestContact(contact: { email: string | null; message: string | null }): boolean {
  const email = (contact.email ?? "").trim().toLowerCase();
  const message = contact.message ?? "";
  return (
    email.startsWith(E2E_CONTACT_EMAIL_PREFIX) &&
    email.endsWith(E2E_CONTACT_EMAIL_DOMAIN) &&
    message.includes(E2E_TEST_MARKER)
  );
}

export function isE2eTestLead(lead: { refCode: string | null; company: string | null }): boolean {
  return lead.refCode === E2E_LEAD_REF && (lead.company ?? "").startsWith(E2E_TEST_MARKER);
}

export function buildPreview(samples: TestDataSample[]): TestDataPreview {
  return { total: samples.length, samples: samples.slice(0, CLEANUP_PREVIEW_SAMPLE_SIZE) };
}
