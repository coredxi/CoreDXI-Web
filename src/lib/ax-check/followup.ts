/**
 * followup.ts — AX 체크 T1(상세 진단) 자동 발송 파이프라인
 *
 * 크론(GET /api/cron/ax-check-followup)과 관리자 "지금 보내기" 버튼이 모두
 * sendFollowupEmail을 호출한다 — 발송 로직은 이 파일 한 곳에만 둔다(설계 6번).
 *
 * 설계: docs/superpowers/specs/2026-09-02-ax-check-auto-followup-design.md 6번
 */

import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { sendResendEmail } from "@/lib/resend";
import { SALES_SIGNATURE } from "./catalog";
import { buildCustomerEmailDraft, wrapEmailBodyAsHtml } from "./email-draft";
import { normalizeLegacyPriorities } from "./summarize";
import type { AxCheckAnswers } from "./summarize";

/**
 * 선점(claim) 실패 — 이미 SENDING이거나 대상 상태가 아님 — 시 반환되는 에러 메시지.
 * processDueFollowups가 이 문자열로 "발송 실패"와 "선점 못 함(skipped)"을 구분한다.
 */
export const CLAIM_LOST_ERROR = "이미 처리 중이거나 발송 가능한 상태가 아닙니다.";

const NORMAL_CLAIM_STATUSES = ["SCHEDULED", "FAILED"] as const;
const FORCE_CLAIM_STATUSES = ["SCHEDULED", "HELD", "SENT", "FAILED", "SKIPPED"] as const;
const MAX_ATTEMPTS = 3;

/**
 * SENDING 상태로 이 시간 이상 방치된 행은 "발송 중 프로세스가 죽었다"고 보고 FAILED로 되돌린다.
 * sendFollowupEmail의 try/catch는 in-process 예외만 잡을 수 있어, 함수 타임아웃·인스턴스
 * 재활용·배포처럼 예외 없이 프로세스가 사라지는 경우엔 SENDING이 영구히 남는다.
 */
const STALE_SENDING_THRESHOLD_MS = 15 * 60 * 1000;
const STALE_SENDING_ERROR = "발송 처리 중 프로세스가 중단되어 자동 복구되었습니다.";

/** AX_CHECK_FOLLOWUP_ENABLED=false가 아니면 true(기본 활성). */
export function isFollowupEnabled(): boolean {
  return process.env.AX_CHECK_FOLLOWUP_ENABLED !== "false";
}

export async function sendFollowupEmail(
  id: string,
  opts?: { force?: boolean }
): Promise<{ success: true } | { success: false; error: string }> {
  const claimStatuses = opts?.force ? FORCE_CLAIM_STATUSES : NORMAL_CLAIM_STATUSES;

  const claim = await prisma.axCheckResponse.updateMany({
    where: { id, followupStatus: { in: [...claimStatuses] } },
    data: { followupStatus: "SENDING" },
  });

  if (claim.count !== 1) {
    return { success: false, error: CLAIM_LOST_ERROR };
  }

  try {
    const record = await prisma.axCheckResponse.findUnique({ where: { id } });
    if (!record) {
      return { success: false, error: "리드를 찾을 수 없습니다." };
    }

    let subject = record.followupSubject;
    let body = record.followupBody;

    if (!subject || !body) {
      const summary = record.summary as unknown as { priorities: unknown };
      const draft = buildCustomerEmailDraft(
        record.answers as AxCheckAnswers,
        {
          priorities: normalizeLegacyPriorities(summary.priorities),
          grade: record.grade,
          score: record.score,
          catalogVersion: record.catalogVersion,
        },
        { company: record.company, name: record.name },
        { mode: "auto" }
      );
      subject = subject ?? draft.subject;
      body = body ?? draft.body;
    }

    const result = await sendResendEmail({
      to: record.email,
      subject,
      text: body,
      html: wrapEmailBodyAsHtml(body),
      replyTo: process.env.SALES_REPLY_TO ?? SALES_SIGNATURE.email,
    });

    if (result.success) {
      await prisma.axCheckResponse.update({
        where: { id },
        data: { followupStatus: "SENT", followupSentAt: new Date(), followupError: null },
      });
      return { success: true };
    }

    await prisma.axCheckResponse.update({
      where: { id },
      data: {
        followupStatus: "FAILED",
        followupError: result.error,
        followupAttempts: { increment: 1 },
      },
    });
    Sentry.captureException(new Error(`ax-check followup send failed: ${result.error}`), {
      tags: { feature: "ax-check-followup" },
      extra: { id },
    });
    return { success: false, error: result.error };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "팔로업 발송 중 알 수 없는 오류가 발생했습니다.";
    Sentry.captureException(e, {
      tags: { feature: "ax-check-followup" },
      extra: { id },
    });

    try {
      await prisma.axCheckResponse.update({
        where: { id },
        data: {
          followupStatus: "FAILED",
          followupError: message,
          followupAttempts: { increment: 1 },
        },
      });
    } catch (recoveryError) {
      Sentry.captureException(recoveryError, {
        tags: { feature: "ax-check-followup-recovery" },
        extra: { id },
      });
    }

    return { success: false, error: message };
  }
}

export async function processDueFollowups(
  opts: { now?: Date; limit?: number } = {}
): Promise<{ processed: number; sent: number; failed: number; skipped: number }> {
  if (!isFollowupEnabled()) {
    return { processed: 0, sent: 0, failed: 0, skipped: 0 };
  }

  const now = opts.now ?? new Date();
  const limit = opts.limit ?? 50;

  // 1단계 — 멈춘 SENDING 행 회수. id를 먼저 확정한 뒤 그 id로만 회수(updateMany)하고,
  // 같은 id를 2단계 발송 대상 조회에서 명시적으로 제외한다 — 방금 회수한 행은 실제로 발송이
  // 이미 성공했었을 수도 있는 행이라, 같은 실행 안에서 곧바로 재시도하면 중복 발송 위험이
  // 있다. 다음 크론에서 일반 FAILED 재시도 경로로 자연스럽게 다시 들어오게 둔다.
  const staleCutoff = new Date(now.getTime() - STALE_SENDING_THRESHOLD_MS);
  const staleSending = await prisma.axCheckResponse.findMany({
    where: { followupStatus: "SENDING", updatedAt: { lt: staleCutoff } },
    select: { id: true },
  });
  const staleSendingIds = staleSending.map((r) => r.id);

  if (staleSendingIds.length > 0) {
    await prisma.axCheckResponse.updateMany({
      where: { id: { in: staleSendingIds } },
      data: {
        followupStatus: "FAILED",
        followupError: STALE_SENDING_ERROR,
        followupAttempts: { increment: 1 },
      },
    });
  }

  // 2단계 — 평소의 발송 대상 조회. 방금 회수한 id는 제외한다.
  const due = await prisma.axCheckResponse.findMany({
    where: {
      ...(staleSendingIds.length > 0 ? { id: { notIn: staleSendingIds } } : {}),
      OR: [
        { followupStatus: "SCHEDULED", followupScheduledAt: { lte: now } },
        {
          followupStatus: "FAILED",
          followupScheduledAt: { lte: now },
          followupAttempts: { lt: MAX_ATTEMPTS },
        },
      ],
    },
    orderBy: { followupScheduledAt: "asc" },
    take: limit,
    select: { id: true },
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const { id } of due) {
    const result = await sendFollowupEmail(id);
    if (result.success) {
      sent += 1;
    } else if (result.error === CLAIM_LOST_ERROR) {
      skipped += 1;
    } else {
      failed += 1;
    }
  }

  return { processed: due.length, sent, failed, skipped };
}
