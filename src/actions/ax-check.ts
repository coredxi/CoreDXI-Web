"use server";

/**
 * ax-check.ts — AX 체크(인터뷰 깔때기) 서버 액션
 *
 * submitAxCheck: 검증 → rate limit → 규칙 기반 요약(summarize.ts) → 저장 →
 * 선택 동의 시 뉴스레터 구독 연동 → 영업이사 알림 메일(고객 발송용 이메일 초안 동봉,
 * 고객에게는 자동 발송하지 않음 — email-draft.ts 참고).
 * 관리자용 listAxCheckResponses/updateAxCheckStatus/updateAxCheckNote/deleteAxCheckResponse는
 * requireAdmin 게이트(contact.ts·newsletter.ts와 동일 패턴).
 *
 * 설계: docs/superpowers/specs/2026-08-22-sales-funnel-ax-check-design.md 4번·5번·7번
 */

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";
import { sendResendEmail } from "@/lib/resend";
import { getContactNotificationEmail } from "@/actions/contact";
import { subscribeNewsletter } from "@/actions/newsletter";
import {
  AX_CHECK_QUESTIONS,
  Q3_MAX_SELECT,
  type AxCheckQuestion,
} from "@/lib/ax-check/catalog";
import { summarizeAxCheck } from "@/lib/ax-check/summarize";
import { buildCustomerEmailDraft } from "@/lib/ax-check/email-draft";
import { generateAxCheckResultToken } from "@/lib/ax-check/result-token";
import type {
  AxCheckAnswers,
  AxCheckFormInput,
  AxCheckLeadRecord,
  AxCheckListResult,
  AxCheckResultLookupResult,
  AxCheckSubmitResult,
  DeleteAxCheckResult,
  LeadStatus,
  UpdateAxCheckNoteResult,
  UpdateAxCheckStatusResult,
} from "@/lib/ax-check/types";
import { LEAD_STATUS_OPTIONS } from "@/lib/ax-check/types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9+\-\s()]{7,20}$/;
const OTHER_TEXT_MAX_LENGTH = 200;
const LEAD_STATUS_SET = new Set<string>(LEAD_STATUS_OPTIONS.map((o) => o.value));

/**
 * 구버전(roadmap 도입 전, ~2026-08-30) 응답 호환 처리 — 당시 summary.priorities는
 * { title, why, firstStep, expectedEffect } 형태였다. 새 필드가 없으면 최소한으로
 * 채워 넣어 화면·이메일 초안이 크래시 없이 렌더링되도록 한다.
 */
function normalizeLegacyPriorities(raw: unknown): AxCheckLeadRecord["priorities"] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const p = item as Partial<AxCheckLeadRecord["priorities"][number]> & { firstStep?: string };
    if (Array.isArray(p.roadmap) && p.roadmap.length === 3) {
      return p as AxCheckLeadRecord["priorities"][number];
    }
    return {
      title: p.title ?? "",
      why: p.why ?? "",
      echo: p.echo ?? "",
      industryExample: p.industryExample ?? null,
      roadmap: [p.firstStep ?? "—", "—", "—"] as const,
      expectedEffect: p.expectedEffect ?? "",
    };
  });
}

async function requireAdmin(): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (session?.user?.accountType !== "admin" || !session.user.role) {
    return { ok: false, error: "관리자 로그인이 필요합니다." };
  }
  return { ok: true };
}

function isValidOptionValue(question: AxCheckQuestion, value: string): boolean {
  if (question.options.some((o) => o.value === value)) return true;
  return question.allowOther === true && value === "other";
}

/** 카탈로그에 정의된 문항 구성과 어긋나는 입력(위조·구버전 프론트)을 걸러낸다. */
function validateAnswers(answers: AxCheckAnswers): string | null {
  for (const question of AX_CHECK_QUESTIONS) {
    if (question.type === "single") {
      const value = answers[question.id];
      if (!value || !isValidOptionValue(question, value)) {
        return "답변 내용을 다시 확인해 주세요.";
      }
      continue;
    }

    const values = answers.q3;
    if (!Array.isArray(values) || values.length === 0 || values.length > Q3_MAX_SELECT) {
      return `반복 업무는 1~${Q3_MAX_SELECT}개를 선택해 주세요.`;
    }
    if (new Set(values).size !== values.length) {
      return "답변 내용을 다시 확인해 주세요.";
    }
    if (!values.every((v) => isValidOptionValue(question, v))) {
      return "답변 내용을 다시 확인해 주세요.";
    }
  }

  if (answers.q3Other && answers.q3Other.trim().length > OTHER_TEXT_MAX_LENGTH) {
    return `기타 응답은 ${OTHER_TEXT_MAX_LENGTH}자 이내로 입력해 주세요.`;
  }

  return null;
}

export async function submitAxCheck(input: AxCheckFormInput): Promise<AxCheckSubmitResult> {
  const company = input.company.trim();
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const phone = input.phone?.trim();
  const refCode = input.refCode?.trim() || null;

  if (!company) {
    return { success: false, error: "회사명을 입력해 주세요." };
  }
  if (!name) {
    return { success: false, error: "성함을 입력해 주세요." };
  }
  if (!email || !EMAIL_PATTERN.test(email)) {
    return { success: false, error: "올바른 이메일 주소를 입력해 주세요." };
  }
  if (phone && !PHONE_PATTERN.test(phone)) {
    return { success: false, error: "올바른 휴대전화 번호를 입력해 주세요." };
  }
  if (!input.privacyConsent) {
    return { success: false, error: "개인정보 수집·이용에 동의해 주세요." };
  }

  const answerError = validateAnswers(input.answers);
  if (answerError) {
    return { success: false, error: answerError };
  }

  const clientIp = await getClientIp();
  const rateLimit = await checkRateLimit(`ax-check:${clientIp}`, {
    max: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!rateLimit.allowed) {
    return {
      success: false,
      error: `너무 많은 요청이 접수되었습니다. ${rateLimit.retryAfterSeconds}초 후 다시 시도해 주세요.`,
    };
  }

  const { priorities, grade, score, catalogVersion } = summarizeAxCheck(input.answers);
  const resultToken = generateAxCheckResultToken();

  try {
    await prisma.axCheckResponse.create({
      data: {
        refCode,
        company,
        name,
        email,
        phone: phone || null,
        answers: input.answers,
        catalogVersion,
        grade,
        score,
        summary: { priorities },
        marketingOptIn: input.marketingOptIn,
        resultToken,
      },
    });
  } catch (e) {
    console.error("[submitAxCheck]", e);
    return { success: false, error: "제출 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }

  if (input.marketingOptIn) {
    const subscribeResult = await subscribeNewsletter(email, "ax-check");
    if (!subscribeResult.success) {
      // 뉴스레터 연동 실패가 AX 체크 제출 성공을 막지 않는다(contact.ts와 동일 원칙).
      console.error("[submitAxCheck] newsletter opt-in failed:", subscribeResult.error);
    }
  }

  const siteUrl = process.env.NEXTAUTH_URL ?? "https://www.coredxi.com";
  const resultUrl = `${siteUrl}/ax-check/result/${resultToken}`;

  // 고객에게는 자동 발송하지 않는다 — 영업이사가 아래 초안을 검토·수정 후 직접 보낸다
  // (2026-08-30 결정, docs/superpowers/specs/2026-08-30-ax-check-experience-upgrade-design.md 5번).
  const emailDraft = buildCustomerEmailDraft(
    input.answers,
    { priorities, grade, score, catalogVersion },
    { company, name }
  );

  const salesNotifyEmail =
    process.env.SALES_NOTIFY_EMAIL?.trim() || (await getContactNotificationEmail());
  if (salesNotifyEmail) {
    const salesMailResult = await sendResendEmail({
      to: salesNotifyEmail,
      subject: `[CoreDXI] 새 AX 체크 리드 - ${grade} - ${company}`,
      text: [
        "새 AX 체크 응답이 접수되었습니다.",
        "",
        `회사: ${company}`,
        `담당자: ${name}`,
        `이메일: ${email}`,
        `연락처: ${phone || "-"}`,
        `유입 경로(ref): ${refCode ?? "-"}`,
        `등급: ${grade}`,
        `결과 재열람 링크: ${resultUrl}`,
        "",
        "관리자 페이지(/admin/leads)에서 전체 답변과 이메일 초안을 확인·복사할 수 있습니다.",
        "아래는 고객에게 보낼 이메일 초안입니다 — 검토·수정 후 직접 발송해 주세요.",
        "",
        "==================== 고객용 이메일 초안: 제목 ====================",
        emailDraft.subject,
        "",
        "==================== 고객용 이메일 초안: 본문 ====================",
        emailDraft.body,
      ].join("\n"),
      replyTo: email,
    });
    if (!salesMailResult.success) {
      console.error("[submitAxCheck] sales notify email failed:", salesMailResult.error);
    }
  }

  return { success: true, priorities, resultToken };
}

export async function getAxCheckResultByToken(token: string): Promise<AxCheckResultLookupResult> {
  const trimmed = token.trim();
  if (!trimmed) {
    return { success: false, error: "유효하지 않은 결과 링크입니다." };
  }

  try {
    const response = await prisma.axCheckResponse.findUnique({
      where: { resultToken: trimmed },
      select: { company: true, summary: true },
    });

    if (!response) {
      return { success: false, error: "유효하지 않은 결과 링크입니다." };
    }

    const summary = response.summary as unknown as { priorities: AxCheckLeadRecord["priorities"] };
    return {
      success: true,
      data: { company: response.company, priorities: normalizeLegacyPriorities(summary.priorities) },
    };
  } catch (e) {
    console.error("[getAxCheckResultByToken]", e);
    return { success: false, error: "결과를 불러오는 중 오류가 발생했습니다." };
  }
}

export async function listAxCheckResponses(): Promise<AxCheckListResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return { success: false, error: gate.error };

  try {
    const responses = await prisma.axCheckResponse.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    // Prisma enum 정렬은 알파벳순(COLD, HOT, WARM)이라 원하는 표시 순서(HOT→WARM→COLD)가
    // 아니므로 조회 후 애플리케이션 레벨에서 재정렬한다.
    const gradeOrder: Record<string, number> = { HOT: 0, WARM: 1, COLD: 2 };
    const sorted = [...responses].sort((a, b) => {
      const gradeDiff = (gradeOrder[a.grade] ?? 99) - (gradeOrder[b.grade] ?? 99);
      if (gradeDiff !== 0) return gradeDiff;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    const leads: AxCheckLeadRecord[] = sorted.map((r) => {
      const summary = r.summary as unknown as { priorities: AxCheckLeadRecord["priorities"] };
      return {
        id: r.id,
        refCode: r.refCode,
        company: r.company,
        name: r.name,
        email: r.email,
        phone: r.phone,
        answers: r.answers as AxCheckAnswers,
        catalogVersion: r.catalogVersion,
        grade: r.grade,
        score: r.score,
        priorities: normalizeLegacyPriorities(summary.priorities),
        status: r.status,
        note: r.note,
        marketingOptIn: r.marketingOptIn,
        followupStatus: r.followupStatus,
        followupScheduledAt: r.followupScheduledAt,
        followupSentAt: r.followupSentAt,
        followupSubject: r.followupSubject,
        followupBody: r.followupBody,
        followupError: r.followupError,
        followupAttempts: r.followupAttempts,
        t0SentAt: r.t0SentAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    });

    return { success: true, leads };
  } catch (e) {
    console.error("[listAxCheckResponses]", e);
    return { success: false, error: "리드 목록을 불러오는 중 오류가 발생했습니다." };
  }
}

export async function updateAxCheckStatus(
  id: string,
  status: LeadStatus
): Promise<UpdateAxCheckStatusResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return { success: false, error: gate.error };

  if (!id.trim() || !LEAD_STATUS_SET.has(status)) {
    return { success: false, error: "유효하지 않은 요청입니다." };
  }

  try {
    await prisma.axCheckResponse.update({ where: { id }, data: { status } });
    revalidatePath("/admin/leads");
    return { success: true };
  } catch (e) {
    console.error("[updateAxCheckStatus]", e);
    return { success: false, error: "상태 변경 중 오류가 발생했습니다." };
  }
}

export async function updateAxCheckNote(id: string, note: string): Promise<UpdateAxCheckNoteResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return { success: false, error: gate.error };

  if (!id.trim()) {
    return { success: false, error: "유효하지 않은 요청입니다." };
  }

  try {
    await prisma.axCheckResponse.update({ where: { id }, data: { note: note.trim() || null } });
    revalidatePath("/admin/leads");
    return { success: true };
  } catch (e) {
    console.error("[updateAxCheckNote]", e);
    return { success: false, error: "메모 저장 중 오류가 발생했습니다." };
  }
}

/** 개인정보 파기 요청 대응용 hard delete. */
export async function deleteAxCheckResponse(id: string): Promise<DeleteAxCheckResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return { success: false, error: gate.error };

  if (!id.trim()) {
    return { success: false, error: "유효하지 않은 요청입니다." };
  }

  try {
    await prisma.axCheckResponse.delete({ where: { id } });
    revalidatePath("/admin/leads");
    return { success: true };
  } catch (e) {
    console.error("[deleteAxCheckResponse]", e);
    return { success: false, error: "삭제 중 오류가 발생했습니다." };
  }
}
