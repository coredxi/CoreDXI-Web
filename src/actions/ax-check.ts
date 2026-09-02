"use server";

/**
 * ax-check.ts — AX 체크(인터뷰 깔때기) 서버 액션
 *
 * submitAxCheck: 검증 → rate limit → 규칙 기반 요약(summarize.ts) → 저장(followupScheduledAt·
 * followupStatus 계산 포함) → 선택 동의 시 뉴스레터 구독 연동 → 킬 스위치가 켜져 있으면 고객에게
 * T0 요약 메일 즉시 발송(email-draft.ts의 buildT0Email) → 영업이사 알림 메일(통화 포인트·
 * 상세 진단 예정 시각·관리 링크만 포함, 고객 발송용 초안 전문은 동봉하지 않음). T1(상세 진단)
 * 자동 발송은 followup.ts가 크론/관리자 액션으로 별도 처리한다.
 * 관리자용 listAxCheckResponses/updateAxCheckStatus/updateAxCheckNote/deleteAxCheckResponse는
 * requireAdmin 게이트(contact.ts·newsletter.ts와 동일 패턴).
 *
 * 설계: docs/superpowers/specs/2026-08-22-sales-funnel-ax-check-design.md 4번·5번·7번,
 * docs/superpowers/specs/2026-09-02-ax-check-auto-followup-design.md
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
  SALES_SIGNATURE,
  getOptionLabel,
  getQuestionById,
  type AxCheckQuestion,
} from "@/lib/ax-check/catalog";
import { normalizeLegacyPriorities, summarizeAxCheck } from "@/lib/ax-check/summarize";
import { buildT0Email } from "@/lib/ax-check/email-draft";
import { generateAxCheckResultToken } from "@/lib/ax-check/result-token";
import { computeFollowupScheduledAt, formatKstFollowupSchedule } from "@/lib/ax-check/business-days";
import { isFollowupEnabled, sendFollowupEmail } from "@/lib/ax-check/followup";
import type {
  AxCheckAnswers,
  AxCheckFormInput,
  AxCheckLeadRecord,
  AxCheckListResult,
  AxCheckResultLookupResult,
  AxCheckSubmitResult,
  DeleteAxCheckResult,
  LeadStatus,
  UpdateAxCheckFollowupResult,
  UpdateAxCheckNoteResult,
  UpdateAxCheckStatusResult,
} from "@/lib/ax-check/types";
import { LEAD_STATUS_OPTIONS } from "@/lib/ax-check/types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9+\-\s()]{7,20}$/;
const OTHER_TEXT_MAX_LENGTH = 200;
const LEAD_STATUS_SET = new Set<string>(LEAD_STATUS_OPTIONS.map((o) => o.value));

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

  const followupEnabled = isFollowupEnabled();
  const followupScheduledAt = computeFollowupScheduledAt(new Date());

  let createdId: string;
  try {
    const created = await prisma.axCheckResponse.create({
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
        followupStatus: followupEnabled ? "SCHEDULED" : "HELD",
        followupScheduledAt,
      },
      select: { id: true },
    });
    createdId = created.id;
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

  // T0 — 제출 즉시 결과 요약 메일. 킬 스위치가 꺼져 있으면 보내지 않는다(완전한 8/30 수동 모드).
  // t0Sent는 결과 화면이 "메일을 보내드렸습니다" 문구를 띄울지 판단하는 근거다.
  let t0Sent = false;
  if (followupEnabled) {
    const t0Draft = buildT0Email(
      { priorities },
      { company, name },
      { resultUrl, brochureUrl: process.env.AX_CHECK_BROCHURE_URL || undefined }
    );
    const t0Result = await sendResendEmail({
      to: email,
      subject: t0Draft.subject,
      text: t0Draft.body,
      html: t0Draft.html,
      // 본문 말미의 수신 거부 안내가 "이 메일에 회신"을 요청하므로 noreply로 떨어지면 안 된다.
      replyTo: process.env.SALES_REPLY_TO ?? SALES_SIGNATURE.email,
    });
    if (t0Result.success) {
      t0Sent = true;
      // t0SentAt 기록 실패가 제출 전체를 실패시키면 안 된다 — 메일은 실제로 나갔다.
      try {
        await prisma.axCheckResponse.update({
          where: { id: createdId },
          data: { t0SentAt: new Date() },
        });
      } catch (e) {
        console.error("[submitAxCheck] t0SentAt update failed:", e);
      }
    } else {
      console.error("[submitAxCheck] T0 email failed:", t0Result.error);
    }
  }

  // 영업이사 알림 메일 — 통화 포인트 3줄 + 예정 발송 시각 + 관리 링크. 초안 전문은 동봉하지 않는다.
  const salesNotifyEmail =
    process.env.SALES_NOTIFY_EMAIL?.trim() || (await getContactNotificationEmail());
  if (salesNotifyEmail) {
    const q3Labels = input.answers.q3
      .slice(0, 2)
      .map((v) => getOptionLabel(getQuestionById("q3"), v));
    const q7Label = getOptionLabel(getQuestionById("q7"), input.answers.q7);
    const q8Label = getOptionLabel(getQuestionById("q8"), input.answers.q8);
    const adminLink = `${siteUrl}/admin/leads?lead=${createdId}`;
    const subjectPrefix = grade === "HOT" ? "[CoreDXI][HOT]" : "[CoreDXI]";

    const salesMailResult = await sendResendEmail({
      to: salesNotifyEmail,
      subject: `${subjectPrefix} 새 AX 체크 리드 - ${grade} - ${company}`,
      text: [
        "새 AX 체크 응답이 접수되었습니다.",
        "",
        `회사: ${company}`,
        `담당자: ${name}`,
        `이메일: ${email}`,
        `연락처: ${phone || "-"}`,
        `유입 경로(ref): ${refCode ?? "-"}`,
        `등급: ${grade}`,
        "",
        "통화 포인트",
        `- 가장 시간이 드는 업무: ${q3Labels.join(", ")}`,
        `- 검토 시점: ${q7Label}`,
        `- 의사결정 구조: ${q8Label}`,
        "",
        followupEnabled
          ? `상세 진단 메일 예정: ${formatKstFollowupSchedule(followupScheduledAt)}`
          : "상세 진단 메일: 자동 발송 꺼짐(HELD) — 관리자 페이지에서 직접 처리해 주세요.",
        `보류·수정·지금 보내기: ${adminLink}`,
        `결과 재열람 링크: ${resultUrl}`,
      ].join("\n"),
      replyTo: email,
    });
    if (!salesMailResult.success) {
      console.error("[submitAxCheck] sales notify email failed:", salesMailResult.error);
    }
  }

  return { success: true, priorities, resultToken, t0Sent };
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

export async function holdAxCheckFollowup(id: string): Promise<UpdateAxCheckFollowupResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  if (!id.trim()) return { success: false, error: "유효하지 않은 요청입니다." };

  try {
    const result = await prisma.axCheckResponse.updateMany({
      where: { id, followupStatus: { in: ["SCHEDULED", "FAILED"] } },
      data: { followupStatus: "HELD" },
    });
    if (result.count !== 1) {
      return { success: false, error: "보류할 수 있는 상태가 아닙니다." };
    }
    revalidatePath("/admin/leads");
    return { success: true };
  } catch (e) {
    console.error("[holdAxCheckFollowup]", e);
    return { success: false, error: "보류 처리 중 오류가 발생했습니다." };
  }
}

export async function resumeAxCheckFollowup(id: string): Promise<UpdateAxCheckFollowupResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  if (!id.trim()) return { success: false, error: "유효하지 않은 요청입니다." };

  try {
    const record = await prisma.axCheckResponse.findUnique({
      where: { id },
      select: { followupStatus: true, followupScheduledAt: true },
    });
    if (!record || record.followupStatus !== "HELD") {
      return { success: false, error: "보류 상태가 아닙니다." };
    }
    const now = new Date();
    const scheduledAt =
      record.followupScheduledAt && record.followupScheduledAt > now
        ? record.followupScheduledAt
        : now;

    await prisma.axCheckResponse.update({
      where: { id },
      data: { followupStatus: "SCHEDULED", followupScheduledAt: scheduledAt },
    });
    revalidatePath("/admin/leads");
    return { success: true };
  } catch (e) {
    console.error("[resumeAxCheckFollowup]", e);
    return { success: false, error: "보류 해제 중 오류가 발생했습니다." };
  }
}

export async function sendAxCheckFollowupNow(id: string): Promise<UpdateAxCheckFollowupResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  if (!id.trim()) return { success: false, error: "유효하지 않은 요청입니다." };

  const result = await sendFollowupEmail(id, { force: true });
  revalidatePath("/admin/leads");
  if (!result.success) {
    return { success: false, error: result.error };
  }
  return { success: true };
}

export async function updateAxCheckFollowupDraft(
  id: string,
  subject: string,
  body: string
): Promise<UpdateAxCheckFollowupResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return { success: false, error: gate.error };

  const trimmedSubject = subject.trim();
  const trimmedBody = body.trim();
  if (!id.trim() || !trimmedSubject || !trimmedBody) {
    return { success: false, error: "제목과 본문을 모두 입력해 주세요." };
  }

  try {
    await prisma.axCheckResponse.update({
      where: { id },
      data: { followupSubject: trimmedSubject, followupBody: trimmedBody },
    });
    revalidatePath("/admin/leads");
    return { success: true };
  } catch (e) {
    console.error("[updateAxCheckFollowupDraft]", e);
    return { success: false, error: "저장 중 오류가 발생했습니다." };
  }
}

export async function resetAxCheckFollowupDraft(id: string): Promise<UpdateAxCheckFollowupResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  if (!id.trim()) return { success: false, error: "유효하지 않은 요청입니다." };

  try {
    await prisma.axCheckResponse.update({
      where: { id },
      data: { followupSubject: null, followupBody: null },
    });
    revalidatePath("/admin/leads");
    return { success: true };
  } catch (e) {
    console.error("[resetAxCheckFollowupDraft]", e);
    return { success: false, error: "초기화 중 오류가 발생했습니다." };
  }
}
