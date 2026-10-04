/**
 * issues.ts — 캠페인의 "현재 주기 호(Issue)"를 찾거나 만든다.
 * [홍보팀] 매일 수집된 기사가 이번 주 발송분(화요일 호) 초안에 쌓이도록 호를 관리하는 부분입니다.
 * 이미 승인·발송된 호는 절대 덮어쓰지 않습니다.
 */
import { prisma } from "@/lib/prisma";
import type { IssueStatus } from "@/generated/prisma/client";
import { computeNextSendAt, kstDateKey, type ScheduleInput } from "./schedule";
import { renderSubjectTemplate } from "./subject";

export const EDITABLE_ISSUE_STATUSES = ["COLLECTING", "DRAFT", "REVIEW_REQUESTED"] as const;
export const ISSUE_MUTATION_RACE_ERROR = "이미 승인되었거나 발송 중인 호는 수정할 수 없습니다";

export type CampaignForIssue = {
  id: string;
  sendType: "IMMEDIATE" | "SCHEDULED" | "REVIEW_THEN_SEND";
  subjectTemplate: string;
} & ScheduleInput;

export type CurrentIssue = { id: string; status: IssueStatus; editedAt: Date | null };

const SELECT = { id: true, status: true, editedAt: true } as const;

function isEditable(status: IssueStatus): boolean {
  return (EDITABLE_ISSUE_STATUSES as readonly IssueStatus[]).includes(status);
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code: unknown }).code === "P2002";
}

export async function ensureCurrentIssue(
  campaign: CampaignForIssue,
  now: Date
): Promise<CurrentIssue | null> {
  const immediate = campaign.sendType === "IMMEDIATE";
  if (immediate && campaign.activeUntil && campaign.activeUntil < now) return null;
  const slot = immediate ? now : computeNextSendAt(campaign, now);
  if (!slot) return null;
  const issueDate = kstDateKey(slot);

  const where = immediate
    ? { campaignId: campaign.id, status: { not: "CANCELED" as const } }
    : { campaignId: campaign.id, issueDate, status: { not: "CANCELED" as const } };

  const existing = await prisma.newsletterIssue.findFirst({ where, orderBy: { issueNo: "desc" }, select: SELECT });
  if (existing) return isEditable(existing.status) ? existing : null;

  const agg = await prisma.newsletterIssue.aggregate({
    where: { campaignId: campaign.id },
    _max: { issueNo: true },
  });
  const issueNo = (agg._max.issueNo ?? 0) + 1;

  try {
    return await prisma.newsletterIssue.create({
      data: {
        campaignId: campaign.id,
        issueNo,
        issueDate,
        subject: renderSubjectTemplate(campaign.subjectTemplate, { issueNo, issueDate }),
        status: "COLLECTING",
      },
      select: SELECT,
    });
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    const raced = await prisma.newsletterIssue.findFirst({ where, orderBy: { issueNo: "desc" }, select: SELECT });
    return raced && isEditable(raced.status) ? raced : null;
  }
}

/**
 * 편집 가능한 호에만 기사를 "선택됨" 후보로 붙인다(관리자 수동 추가·수집 기사 붙이기 공용).
 * 같은 트랜잭션 안에서 상태 조건부 갱신(editedAt 기록 + DRAFT로 되돌림)이 성공했을 때만 기사 행을 쓴다 —
 * 화면을 연 뒤 다른 사람이 승인·발송을 시작했다면 false를 돌려주고 아무것도 바꾸지 않는다.
 */
export async function attachArticleIfEditable(issueId: string, articleId: string, ruleScore: number): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const r = await tx.newsletterIssue.updateMany({
      where: { id: issueId, status: { in: [...EDITABLE_ISSUE_STATUSES] } },
      data: { editedAt: new Date(), status: "DRAFT" },
    });
    if (r.count !== 1) return false;
    const sortOrder = await tx.newsletterIssueArticle.count({ where: { issueId } });
    await tx.newsletterIssueArticle.upsert({
      where: { issueId_articleId: { issueId, articleId } },
      create: { issueId, articleId, ruleScore, isSelected: true, sortOrder },
      update: { isSelected: true },
    });
    return true;
  });
}
