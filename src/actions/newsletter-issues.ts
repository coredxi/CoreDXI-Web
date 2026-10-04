"use server";

/**
 * newsletter-issues.ts — 뉴스레터 호(발송 단위) 편집·검토·승인·발송 Server Actions
 * [홍보팀] 선별 편집 화면의 "저장 / 검토요청(내게 보내기) / 승인·예약 / 즉시 발송 / 취소"와
 * 발송 이력 화면의 "재시도" 버튼이 호출합니다. 모든 동작은 해당 캠페인 담당자만 할 수 있습니다.
 */
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCampaignManager, requireNewsletterAdmin } from "@/lib/newsletter/admin-guard";
import { EDITABLE_ISSUE_STATUSES, ISSUE_MUTATION_RACE_ERROR, attachArticleIfEditable } from "@/lib/newsletter/issues";
import { FIXED_SEND_HOUR_KST } from "@/lib/newsletter/defaults";
import { computeNextSendAt, snapToSendSlot } from "@/lib/newsletter/schedule";
import { renderIssueEmail, sendIssue, sendTestIssue, type SendIssueResult } from "@/lib/newsletter/send";
import { DRAFT_CAMPAIGN_ERROR, type NewsletterActionResult } from "@/lib/newsletter/types";

export type IssueArticleEdit = {
  id: string;
  isSelected: boolean;
  sortOrder: number;
  editorNote: string | null;
  summary: string | null;
};

const MUTATION_RACE = ISSUE_MUTATION_RACE_ERROR;
const NO_SELECTION_ERROR = "아직 선택된 기사가 없습니다. 기사를 선택하고 저장한 뒤 발송해 주세요.";
const NOT_EDITABLE = "이미 승인·발송된 호는 수정할 수 없습니다. 먼저 '승인 취소'를 눌러 주세요.";

async function loadIssueWithGate(issueId: string, opts: { mutating?: boolean } = {}) {
  const issue = await prisma.newsletterIssue.findUnique({
    where: { id: issueId },
    select: {
      id: true,
      campaignId: true,
      status: true,
      campaign: { select: { isDraft: true, cadence: true, sendDayOfWeek: true, sendHourKst: true, activeFrom: true, activeUntil: true } },
    },
  });
  if (!issue) return { ok: false as const, error: "호를 찾을 수 없습니다." };
  const gate = await requireCampaignManager(issue.campaignId);
  if (!gate.ok) return { ok: false as const, error: gate.error };
  if (opts.mutating && issue.campaign.isDraft) return { ok: false as const, error: DRAFT_CAMPAIGN_ERROR };
  return { ok: true as const, issue, admin: gate.admin };
}

function revalidateIssue(campaignId: string, issueId: string) {
  revalidatePath(`/admin/newsletter/campaigns/${campaignId}/issues/${issueId}`);
  revalidatePath("/admin/newsletter/history");
}

function isEditable(status: string): boolean {
  return (EDITABLE_ISSUE_STATUSES as readonly string[]).includes(status);
}

export async function getIssueForEdit(issueId: string) {
  const loaded = await loadIssueWithGate(issueId);
  if (!loaded.ok) return { success: false as const, error: loaded.error };
  const issue = await prisma.newsletterIssue.findUnique({
    where: { id: issueId },
    include: {
      campaign: { select: { id: true, name: true, maxArticles: true } },
      articles: { orderBy: [{ isSelected: "desc" }, { sortOrder: "asc" }], include: { article: { include: { source: true } } } },
    },
  });
  if (!issue) return { success: false as const, error: "호를 찾을 수 없습니다." };
  return { success: true as const, issue };
}

export async function getIssuePreview(issueId: string): Promise<NewsletterActionResult<{ subject: string; html: string }>> {
  const loaded = await loadIssueWithGate(issueId);
  if (!loaded.ok) return { success: false, error: loaded.error };
  const rendered = await renderIssueEmail(issueId);
  if (!rendered) return { success: false, error: "호를 찾을 수 없습니다." };
  return { success: true, subject: rendered.subject, html: rendered.html };
}

export async function updateIssue(
  issueId: string,
  input: { subject: string; intro: string | null; articles: IssueArticleEdit[] }
): Promise<NewsletterActionResult> {
  const loaded = await loadIssueWithGate(issueId, { mutating: true });
  if (!loaded.ok) return { success: false, error: loaded.error };
  if (!isEditable(loaded.issue.status)) return { success: false, error: NOT_EDITABLE };
  const subject = input.subject.trim();
  if (!subject) return { success: false, error: "메일 제목을 입력해 주세요." };

  const ok = await prisma.$transaction(async (tx) => {
    const r = await tx.newsletterIssue.updateMany({
      where: { id: issueId, status: { in: [...EDITABLE_ISSUE_STATUSES] } },
      data: { subject, intro: input.intro?.trim() || null, editedAt: new Date() },
    });
    if (r.count !== 1) return false;
    for (const a of input.articles) {
      await tx.newsletterIssueArticle.update({
        where: { id: a.id, issueId },
        data: {
          isSelected: a.isSelected,
          sortOrder: a.sortOrder,
          editorNote: a.editorNote?.trim() || null,
          summary: a.summary?.trim() || null,
        },
      });
    }
    return true;
  });
  if (!ok) return { success: false, error: MUTATION_RACE };
  revalidateIssue(loaded.issue.campaignId, issueId);
  return { success: true };
}

export async function attachArticleToIssue(issueId: string, articleId: string): Promise<NewsletterActionResult> {
  const loaded = await loadIssueWithGate(issueId, { mutating: true });
  if (!loaded.ok) return { success: false, error: loaded.error };
  if (!isEditable(loaded.issue.status)) return { success: false, error: NOT_EDITABLE };
  const ok = await attachArticleIfEditable(issueId, articleId, 0);
  if (!ok) return { success: false, error: MUTATION_RACE };
  revalidateIssue(loaded.issue.campaignId, issueId);
  return { success: true };
}

export async function requestIssueReview(issueId: string): Promise<NewsletterActionResult<{ recipients: string[] }>> {
  const loaded = await loadIssueWithGate(issueId, { mutating: true });
  if (!loaded.ok) return { success: false, error: loaded.error };

  const extra = (process.env.NEWSLETTER_TEST_RECIPIENTS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const recipients = [...new Set([loaded.admin.email?.toLowerCase(), ...extra].filter((e): e is string => !!e))];

  const result = await sendTestIssue(issueId, recipients);
  if (!result.success) return { success: false, error: result.error };

  await prisma.newsletterIssue.updateMany({
    where: { id: issueId, status: { in: ["COLLECTING", "DRAFT"] } },
    data: { status: "REVIEW_REQUESTED" },
  });
  revalidateIssue(loaded.issue.campaignId, issueId);
  return { success: true, recipients };
}

export async function approveIssue(
  issueId: string,
  scheduledAtIso: string | null
): Promise<NewsletterActionResult<{ scheduledAt: string }>> {
  const loaded = await loadIssueWithGate(issueId, { mutating: true });
  if (!loaded.ok) return { success: false, error: loaded.error };

  const selected = await prisma.newsletterIssueArticle.count({ where: { issueId, isSelected: true } });
  if (selected === 0) return { success: false, error: "선별된 기사가 없습니다. 기사를 1건 이상 선택해 주세요." };

  const now = new Date();
  let scheduledAt: Date | null;
  if (scheduledAtIso) {
    const chosen = new Date(scheduledAtIso);
    if (Number.isNaN(chosen.getTime()) || chosen <= now) {
      return { success: false, error: "예약 시각은 현재 이후여야 합니다. 지금 보내려면 '즉시 발송'을 눌러 주세요." };
    }
    // 1단계 발송 Cron은 매일 08:00 KST 한 번 — 고른 시각 이후 첫 08시 슬롯으로 맞춰 저장한다.
    scheduledAt = snapToSendSlot(chosen, FIXED_SEND_HOUR_KST);
    const { activeUntil } = loaded.issue.campaign;
    if (activeUntil && scheduledAt > activeUntil) {
      return { success: false, error: "08시 발송 슬롯으로 맞춘 예약 시각이 캠페인 사용기간을 넘습니다. 날짜를 앞당겨 주세요." };
    }
  } else {
    scheduledAt = computeNextSendAt(loaded.issue.campaign, now);
    if (!scheduledAt) return { success: false, error: "캠페인 사용기간 안에 남은 발송일이 없습니다." };
  }

  const r = await prisma.newsletterIssue.updateMany({
    where: { id: issueId, status: { in: [...EDITABLE_ISSUE_STATUSES] } },
    data: { status: "APPROVED", scheduledAt, approvedById: loaded.admin.adminId, approvedAt: now, lastError: null },
  });
  if (r.count !== 1) return { success: false, error: NOT_EDITABLE };
  revalidateIssue(loaded.issue.campaignId, issueId);
  return { success: true, scheduledAt: scheduledAt.toISOString() };
}

export async function unapproveIssue(issueId: string): Promise<NewsletterActionResult> {
  const loaded = await loadIssueWithGate(issueId);
  if (!loaded.ok) return { success: false, error: loaded.error };
  const r = await prisma.newsletterIssue.updateMany({
    where: { id: issueId, status: "APPROVED" },
    data: { status: "DRAFT", scheduledAt: null, approvedById: null, approvedAt: null },
  });
  if (r.count !== 1) return { success: false, error: "승인 상태가 아닙니다." };
  revalidateIssue(loaded.issue.campaignId, issueId);
  return { success: true };
}

export async function cancelIssue(issueId: string): Promise<NewsletterActionResult> {
  const loaded = await loadIssueWithGate(issueId);
  if (!loaded.ok) return { success: false, error: loaded.error };
  const r = await prisma.newsletterIssue.updateMany({
    where: { id: issueId, status: { in: [...EDITABLE_ISSUE_STATUSES, "APPROVED"] } },
    data: { status: "CANCELED" },
  });
  if (r.count !== 1) return { success: false, error: "발송 중이거나 이미 발송된 호는 취소할 수 없습니다." };
  revalidateIssue(loaded.issue.campaignId, issueId);
  return { success: true };
}

export async function sendIssueNow(issueId: string): Promise<SendIssueResult> {
  const loaded = await loadIssueWithGate(issueId, { mutating: true });
  if (!loaded.ok) return { success: false, error: loaded.error };
  if (loaded.issue.status === "COLLECTING") return { success: false, error: NO_SELECTION_ERROR };
  const result = await sendIssue(issueId, { allowFrom: ["DRAFT", "REVIEW_REQUESTED", "APPROVED", "FAILED"] });
  revalidateIssue(loaded.issue.campaignId, issueId);
  return result;
}

export async function retryIssue(issueId: string): Promise<SendIssueResult> {
  const loaded = await loadIssueWithGate(issueId, { mutating: true });
  if (!loaded.ok) return { success: false, error: loaded.error };
  const result = await sendIssue(issueId, { allowFrom: ["FAILED"] });
  revalidateIssue(loaded.issue.campaignId, issueId);
  return result;
}

export async function listIssueHistory() {
  const gate = await requireNewsletterAdmin();
  if (!gate.ok) return { success: false as const, error: gate.error };
  const issues = await prisma.newsletterIssue.findMany({
    where: { status: { in: ["APPROVED", "SENDING", "SENT", "FAILED", "CANCELED"] } },
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      campaign: { select: { id: true, name: true } },
      _count: { select: { deliveries: true } },
      deliveries: { where: { status: "FAILED" }, select: { id: true } },
    },
  });
  return { success: true as const, issues };
}
