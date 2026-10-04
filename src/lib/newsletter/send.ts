/**
 * send.ts — 뉴스레터 호 발송. 크론(newsletter-send)과 관리자 "즉시 발송"·"재시도"가 모두 sendIssue를 호출한다.
 * [홍보팀] 승인된 뉴스레터를 구독자에게 한 통씩 보내고, 누가 받았는지 발송 이력에 남기는 부분입니다.
 * 중간에 끊겨도 다시 실행하면 아직 못 받은 사람에게만 보냅니다(중복 발송 없음).
 * 패턴: src/lib/ax-check/followup.ts(선점·멈춘 SENDING 회수)
 */
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { sendResendEmail } from "@/lib/resend";
import { SALES_SIGNATURE } from "@/lib/ax-check/catalog";
import type { IssueStatus } from "@/generated/prisma/client";
import { NEWSLETTER_SITE_ORIGIN, UNSUBSCRIBE_PLACEHOLDER, renderAxWeekly } from "./templates/ax-weekly";
import { ensureAdPrefix } from "./subject";

export const ISSUE_SEND_LOCK_ERROR = "이미 발송 중이거나 발송할 수 없는 상태입니다.";
const NO_ARTICLES_ERROR = "선별된 기사가 없습니다.";
const NO_RECIPIENTS_ERROR = "발송 대상 수신자가 없습니다(구독자 0명 또는 내부 수신자 미지정). 수신자를 확인한 뒤 재시도하세요.";
const STALE_SENDING_MS = 15 * 60 * 1000;
const STALE_SENDING_ERROR = "발송 처리 중 프로세스가 중단되어 자동 복구되었습니다. 발송 이력에서 재시도하세요.";
const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;
const DEFAULT_THROTTLE_MS = 600; // Resend API 초당 요청 한도 여유
const SITE_URL = NEWSLETTER_SITE_ORIGIN;

export function getMaxRecipients(): number {
  const n = Number(process.env.NEWSLETTER_MAX_RECIPIENTS ?? 80);
  return Number.isFinite(n) && n > 0 ? n : 80;
}

export type SendIssueResult =
  | { success: true; sent: number; failed: number; skipped: number }
  | { success: false; error: string };

type Recipient = { subscriberId: string | null; email: string; unsubscribeUrl: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function internalUnsubscribeUrl(): string {
  return `mailto:${SALES_SIGNATURE.email}?subject=${encodeURIComponent("뉴스레터 수신 중단 요청")}`;
}

async function loadIssue(issueId: string) {
  return prisma.newsletterIssue.findUnique({
    where: { id: issueId },
    include: {
      campaign: true,
      articles: {
        where: { isSelected: true },
        orderBy: { sortOrder: "asc" },
        include: { article: { include: { source: true } } },
      },
    },
  });
}

type LoadedIssue = NonNullable<Awaited<ReturnType<typeof loadIssue>>>;

function render(issue: LoadedIssue) {
  return renderAxWeekly({
    issueNo: issue.issueNo,
    issueDate: issue.issueDate,
    subject: issue.subject,
    intro: issue.intro,
    siteUrl: SITE_URL,
    articles: issue.articles.map((ia) => ({
      title: ia.article.title,
      url: ia.article.originalUrl,
      sourceName: ia.article.source?.name ?? ia.article.sourceName,
      publishedAt: ia.article.publishedAt,
      summary: ia.summary,
      snippet: ia.article.snippet,
      editorNote: ia.editorNote,
    })),
  });
}

async function resolveRecipients(issue: LoadedIssue): Promise<Recipient[]> {
  if (issue.campaign.audience === "internal") {
    return issue.campaign.internalRecipients.map((email) => ({
      subscriberId: null,
      email,
      unsubscribeUrl: internalUnsubscribeUrl(),
    }));
  }
  const subscribers = await prisma.newsletterSubscriber.findMany({
    where: { status: "SUBSCRIBED" },
    select: { id: true, email: true, unsubscribeToken: true },
  });
  return subscribers.map((s) => ({
    subscriberId: s.id,
    email: s.email,
    unsubscribeUrl: `${SITE_URL}/unsubscribe/${s.unsubscribeToken}`,
  }));
}

export async function renderIssueEmail(issueId: string) {
  const issue = await loadIssue(issueId);
  return issue ? render(issue) : null;
}

export async function sendIssue(
  issueId: string,
  opts: { allowFrom?: readonly IssueStatus[]; throttleMs?: number } = {}
): Promise<SendIssueResult> {
  const allowFrom = opts.allowFrom ?? (["APPROVED", "FAILED"] as const);
  const throttleMs = opts.throttleMs ?? DEFAULT_THROTTLE_MS;

  const claim = await prisma.newsletterIssue.updateMany({
    where: { id: issueId, status: { in: [...allowFrom] } },
    data: { status: "SENDING" },
  });
  if (claim.count !== 1) return { success: false, error: ISSUE_SEND_LOCK_ERROR };

  try {
    const issue = await loadIssue(issueId);
    if (!issue) return { success: false, error: "호를 찾을 수 없습니다." };
    if (issue.articles.length === 0) {
      await prisma.newsletterIssue.update({
        where: { id: issueId },
        data: { status: "DRAFT", lastError: NO_ARTICLES_ERROR },
      });
      return { success: false, error: NO_ARTICLES_ERROR };
    }

    const recipients = await resolveRecipients(issue);
    if (recipients.length === 0) {
      await prisma.newsletterIssue.update({ where: { id: issueId }, data: { status: "FAILED", lastError: NO_RECIPIENTS_ERROR } });
      return { success: false, error: NO_RECIPIENTS_ERROR };
    }
    const max = getMaxRecipients();
    if (recipients.length > max) {
      const error = `수신자 ${recipients.length}명이 1회 상한(${max}명)을 넘습니다. Resend 일 한도 때문에 Batch 전환(2단계)이 필요합니다.`;
      await prisma.newsletterIssue.update({ where: { id: issueId }, data: { status: "FAILED", lastError: error } });
      return { success: false, error };
    }
    // 일 한도: 최근 24시간 동안 다른 호로 이미 보낸 수 + 이번 호 수신자 수가 상한을 넘으면 거부(Resend 무료 일 100통).
    const sentLast24h = await prisma.newsletterDelivery.count({
      where: { status: "SENT", sentAt: { gte: new Date(Date.now() - DAILY_WINDOW_MS) }, issueId: { not: issueId } },
    });
    if (sentLast24h + recipients.length > max) {
      const error = `최근 24시간 발송 ${sentLast24h}통 + 이번 수신자 ${recipients.length}명이 일 상한(${max}통)을 넘습니다. 24시간 뒤 발송 이력에서 재시도하세요.`;
      await prisma.newsletterIssue.update({ where: { id: issueId }, data: { status: "FAILED", lastError: error } });
      return { success: false, error };
    }

    await prisma.newsletterDelivery.createMany({
      data: recipients.map((r) => ({ issueId, subscriberId: r.subscriberId, email: r.email })),
      skipDuplicates: true,
    });

    const rendered = render(issue);
    const byEmail = new Map(recipients.map((r) => [r.email, r]));
    const pending = await prisma.newsletterDelivery.findMany({
      where: { issueId, status: { in: ["QUEUED", "FAILED"] } },
      select: { id: true, email: true, subscriberId: true },
    });

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const sentSubscriberIds: string[] = [];

    for (const [index, d] of pending.entries()) {
      const recipient = byEmail.get(d.email);
      if (!recipient) {
        await prisma.newsletterDelivery.update({ where: { id: d.id }, data: { status: "SKIPPED" } });
        skipped += 1;
        continue;
      }
      if (index > 0 && throttleMs > 0) await sleep(throttleMs);

      const result = await sendResendEmail({
        to: d.email,
        subject: rendered.subject,
        html: rendered.html.replaceAll(UNSUBSCRIBE_PLACEHOLDER, recipient.unsubscribeUrl),
        text: rendered.text.replaceAll(UNSUBSCRIBE_PLACEHOLDER, recipient.unsubscribeUrl),
        headers: { "List-Unsubscribe": `<${recipient.unsubscribeUrl}>` },
        // 응답 유실 후 재시도해도 Resend가 같은 수신자에게 두 번 보내지 않도록(24시간 유효).
        idempotencyKey: `newsletter:${issueId}:${d.email}`,
      });

      if (result.success) {
        await prisma.newsletterDelivery.update({
          where: { id: d.id },
          data: { status: "SENT", resendId: result.id ?? null, error: null, sentAt: new Date() },
        });
        sent += 1;
        if (d.subscriberId) sentSubscriberIds.push(d.subscriberId);
      } else {
        await prisma.newsletterDelivery.update({
          where: { id: d.id },
          data: { status: "FAILED", error: result.error },
        });
        failed += 1;
      }
    }

    if (sentSubscriberIds.length > 0) {
      await prisma.newsletterSubscriber.updateMany({
        where: { id: { in: sentSubscriberIds } },
        data: { lastSentAt: new Date() },
      });
    }

    const recipientCount = await prisma.newsletterDelivery.count({ where: { issueId, status: "SENT" } });
    await prisma.newsletterIssue.update({
      where: { id: issueId },
      data: {
        status: failed > 0 ? "FAILED" : "SENT",
        sentAt: sent > 0 ? new Date() : undefined,
        recipientCount,
        lastError: failed > 0 ? `${failed}건 발송 실패` : null,
      },
    });
    return { success: true, sent, failed, skipped };
  } catch (e) {
    const message = e instanceof Error ? e.message : "뉴스레터 발송 중 알 수 없는 오류가 발생했습니다.";
    Sentry.captureException(e, { tags: { feature: "newsletter-send" }, extra: { issueId } });
    try {
      await prisma.newsletterIssue.update({ where: { id: issueId }, data: { status: "FAILED", lastError: message } });
    } catch (recoveryError) {
      Sentry.captureException(recoveryError, { tags: { feature: "newsletter-send-recovery" }, extra: { issueId } });
    }
    return { success: false, error: message };
  }
}

export async function processDueIssues(
  opts: { now?: Date; throttleMs?: number } = {}
): Promise<{ processed: number; sent: number; failed: number; recovered: number }> {
  const now = opts.now ?? new Date();

  const stale = await prisma.newsletterIssue.findMany({
    where: { status: "SENDING", updatedAt: { lt: new Date(now.getTime() - STALE_SENDING_MS) } },
    select: { id: true },
  });
  if (stale.length > 0) {
    await prisma.newsletterIssue.updateMany({
      // 조회와 갱신 사이에 정상 완료(SENT)된 호를 FAILED로 덮어쓰지 않도록 상태 조건을 함께 건다.
      where: { id: { in: stale.map((s) => s.id) }, status: "SENDING" },
      data: { status: "FAILED", lastError: STALE_SENDING_ERROR },
    });
  }

  // 캠페인을 "미사용 처리"했거나 사용기간이 끝났으면 이미 승인된 호도 보내지 않는다.
  const due = await prisma.newsletterIssue.findMany({
    where: {
      status: "APPROVED",
      scheduledAt: { lte: now },
      campaign: { isActive: true, OR: [{ activeUntil: null }, { activeUntil: { gte: now } }] },
    },
    orderBy: { scheduledAt: "asc" },
    select: { id: true },
  });

  let sent = 0;
  let failed = 0;
  for (const { id } of due) {
    const result = await sendIssue(id, { allowFrom: ["APPROVED"], throttleMs: opts.throttleMs });
    if (result.success && result.failed === 0) sent += 1;
    else failed += 1;
  }
  return { processed: due.length, sent, failed, recovered: stale.length };
}

export async function sendTestIssue(
  issueId: string,
  recipients: string[]
): Promise<{ success: true } | { success: false; error: string }> {
  const issue = await loadIssue(issueId);
  if (!issue) return { success: false, error: "호를 찾을 수 없습니다." };
  if (recipients.length === 0) return { success: false, error: "테스트 수신자가 없습니다." };

  const rendered = render(issue);
  const unsubscribeUrl = `${SITE_URL}/#newsletter`;
  const result = await sendResendEmail({
    to: recipients,
    subject: ensureAdPrefix(`[테스트] ${rendered.subject}`),
    html: rendered.html.replaceAll(UNSUBSCRIBE_PLACEHOLDER, unsubscribeUrl),
    text: rendered.text.replaceAll(UNSUBSCRIBE_PLACEHOLDER, unsubscribeUrl),
  });
  return result.success ? { success: true } : { success: false, error: result.error };
}
