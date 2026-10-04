"use server";

/**
 * newsletter-campaigns.ts — 뉴스레터 캠페인(기준) 관리 Server Actions
 * [홍보팀] /admin/newsletter/campaigns 화면의 저장·미사용·삭제·지금 수집·키워드 미리보기·기사 직접 추가 버튼이 호출합니다.
 * 설계: docs/superpowers/specs/2026-09-28-newsletter-distribution-design.md 3·7절
 */
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCampaignManager, requireNewsletterAdmin } from "@/lib/newsletter/admin-guard";
import { validateCampaignInput, type CampaignFormInput } from "@/lib/newsletter/campaign-input";
import { collectCampaign } from "@/lib/newsletter/collect/collect-campaign";
import { searchNaverNews } from "@/lib/newsletter/collect/naver-news";
import { ensureCurrentIssue, type CampaignForIssue } from "@/lib/newsletter/issues";
import { keywordHitRate, matchKeywords, pickQueryTerms } from "@/lib/newsletter/keyword-filter";
import { SNIPPET_MAX_LENGTH, cleanText, computeTitleHash, hostOf, normalizeUrl } from "@/lib/newsletter/normalize";
import { kstYmdToUtc } from "@/lib/newsletter/schedule";
import type { KeywordInput, NewsletterActionResult } from "@/lib/newsletter/types";

const BASE_PATH = "/admin/newsletter/campaigns";
const DRAFT_ERROR = "임시저장 캠페인은 먼저 저장을 완료해 주세요";

export async function listCampaigns() {
  const gate = await requireNewsletterAdmin();
  if (!gate.ok) return { success: false as const, error: gate.error };
  const campaigns = await prisma.newsletterCampaign.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      issues: { orderBy: { issueNo: "desc" }, take: 1, select: { id: true, issueNo: true, status: true, scheduledAt: true, issueDate: true } },
    },
  });
  return { success: true as const, campaigns };
}

export async function getCampaignForEdit(id: string) {
  const gate = await requireCampaignManager(id);
  if (!gate.ok) return { success: false as const, error: gate.error };
  const campaign = await prisma.newsletterCampaign.findUnique({
    where: { id },
    include: {
      keywords: { orderBy: [{ group: "asc" }, { weight: "desc" }] },
      rules: true,
      sources: true,
      issues: { orderBy: { issueNo: "desc" }, take: 5 },
    },
  });
  if (!campaign) return { success: false as const, error: "캠페인을 찾을 수 없습니다." };
  return { success: true as const, campaign };
}

export async function listNewsSources() {
  const gate = await requireNewsletterAdmin();
  if (!gate.ok) return { success: false as const, error: gate.error };
  const sources = await prisma.newsSource.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] });
  return { success: true as const, sources };
}

export async function saveCampaign(
  input: CampaignFormInput,
  opts: { draft: boolean }
): Promise<NewsletterActionResult<{ id: string }>> {
  const gate = input.id ? await requireCampaignManager(input.id) : await requireNewsletterAdmin();
  if (!gate.ok) return { success: false, error: gate.error };

  const v = validateCampaignInput(input, opts);
  if (!v.ok) return { success: false, error: v.error };
  const d = v.data;

  const fields = {
    name: d.name,
    subjectTemplate: d.subjectTemplate,
    sendType: d.sendType,
    cadence: d.cadence,
    sendDayOfWeek: d.sendDayOfWeek,
    sendHourKst: d.sendHourKst,
    activeFrom: d.activeFrom,
    activeUntil: d.activeUntil,
    collectDays: d.collectDays,
    maxArticles: d.maxArticles,
    audience: d.audience,
    internalRecipients: d.internalRecipients,
    isDraft: opts.draft,
  };
  const children = {
    keywords: { create: d.keywords.map((k) => ({ group: k.group, operator: k.operator, term: k.term, weight: k.weight })) },
    rules: { create: d.rules.map((r) => ({ indicator: r.indicator, label: r.label, description: r.description, weight: r.weight, isEnabled: r.isEnabled })) },
    sources: { create: d.sourceIds.map((sourceId) => ({ sourceId })) },
  };

  try {
    if (!input.id) {
      const created = await prisma.newsletterCampaign.create({
        data: { ...fields, ownerId: gate.admin.adminId, ...children },
        select: { id: true },
      });
      revalidatePath(BASE_PATH);
      return { success: true, id: created.id };
    }

    const id = input.id;
    await prisma.$transaction(async (tx) => {
      await tx.newsletterKeyword.deleteMany({ where: { campaignId: id } });
      await tx.newsletterSelectionRule.deleteMany({ where: { campaignId: id } });
      await tx.newsletterCampaignSource.deleteMany({ where: { campaignId: id } });
      await tx.newsletterCampaign.update({ where: { id }, data: { ...fields, ...children } });
    });
    revalidatePath(BASE_PATH);
    revalidatePath(`${BASE_PATH}/${id}`);
    return { success: true, id };
  } catch (e) {
    console.error("[saveCampaign]", e);
    return { success: false, error: "캠페인 저장 중 오류가 발생했습니다." };
  }
}

export async function setCampaignActive(id: string, active: boolean): Promise<NewsletterActionResult> {
  const gate = await requireCampaignManager(id);
  if (!gate.ok) return { success: false, error: gate.error };
  await prisma.newsletterCampaign.update({ where: { id }, data: { isActive: active } });
  revalidatePath(BASE_PATH);
  return { success: true };
}

export async function deleteDraftCampaign(id: string): Promise<NewsletterActionResult> {
  const gate = await requireCampaignManager(id);
  if (!gate.ok) return { success: false, error: gate.error };
  const campaign = await prisma.newsletterCampaign.findUnique({ where: { id }, select: { isDraft: true } });
  if (!campaign?.isDraft) return { success: false, error: "임시저장 상태의 캠페인만 삭제할 수 있습니다. 대신 '미사용'으로 바꿔 주세요." };
  if ((await prisma.newsletterIssue.count({ where: { campaignId: id } })) > 0) {
    return { success: false, error: "이미 만들어진 호가 있어 삭제할 수 없습니다. '미사용'으로 바꿔 주세요." };
  }
  await prisma.newsletterCampaign.delete({ where: { id } });
  revalidatePath(BASE_PATH);
  return { success: true };
}

export type KeywordPreviewItem = { title: string; url: string; publishedAt: string; hitRate: number };

/** 위저드 ③단계 "결과 미리보기" — 네이버 API 즉시 조회 후 로컬 필터를 통과한 10건. */
export async function previewKeywordSearch(
  keywords: KeywordInput[]
): Promise<NewsletterActionResult<{ items: KeywordPreviewItem[] }>> {
  const gate = await requireNewsletterAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const terms = pickQueryTerms(keywords);
  if (terms.length === 0) return { success: false, error: "포함 키워드를 먼저 입력해 주세요." };
  try {
    const results = (await Promise.all(terms.slice(0, 3).map((t) => searchNaverNews(t, { display: 50 })))).flat();
    const items = results
      .map((a) => ({ a, m: matchKeywords(keywords, a.title, a.snippet ?? "") }))
      .filter(({ m }) => m.passes)
      .slice(0, 10)
      .map(({ a, m }) => ({ title: a.title, url: a.originalUrl, publishedAt: a.publishedAt.toISOString(), hitRate: keywordHitRate(m) }));
    return { success: true, items };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "미리보기 조회에 실패했습니다." };
  }
}

export async function collectCampaignNow(
  id: string
): Promise<NewsletterActionResult<{ fetched: number; stored: number; matched: number; attached: number; issueId: string | null; errors: string[] }>> {
  const gate = await requireCampaignManager(id);
  if (!gate.ok) return { success: false, error: gate.error };
  const draftCheck = await prisma.newsletterCampaign.findUnique({ where: { id }, select: { isDraft: true } });
  if (draftCheck?.isDraft) return { success: false, error: DRAFT_ERROR };
  const r = await collectCampaign(id);
  revalidatePath(`${BASE_PATH}/${id}`);
  revalidatePath(`${BASE_PATH}/${id}/articles`);
  return { success: true, fetched: r.fetched, stored: r.stored, matched: r.matched, attached: r.attached, issueId: r.issueId, errors: r.errors };
}

export type ManualArticleInput = { url: string; title: string; sourceName: string; publishedAt: string; snippet: string };

/** 관리자가 기사를 직접 추가(origin=MANUAL) → 현재 호에 선택된 후보로 붙인다. */
export async function addManualArticle(
  campaignId: string,
  input: ManualArticleInput
): Promise<NewsletterActionResult<{ issueId: string }>> {
  const gate = await requireCampaignManager(campaignId);
  if (!gate.ok) return { success: false, error: gate.error };

  const urlNormalized = normalizeUrl(input.url);
  const title = cleanText(input.title);
  if (!urlNormalized) return { success: false, error: "기사 URL은 http(s) 주소여야 합니다." };
  if (!title) return { success: false, error: "기사 제목을 입력해 주세요." };
  const publishedAt = kstYmdToUtc(input.publishedAt) ?? new Date();

  const campaign = await prisma.newsletterCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return { success: false, error: "캠페인을 찾을 수 없습니다." };
  if (campaign.isDraft) return { success: false, error: DRAFT_ERROR };
  const issue = await ensureCurrentIssue(campaign as CampaignForIssue, new Date());
  if (!issue) return { success: false, error: "편집 가능한 이번 호가 없습니다(사용기간 종료 또는 이미 승인됨)." };

  const article = await prisma.newsArticle.upsert({
    where: { urlNormalized },
    update: {},
    create: {
      urlNormalized,
      originalUrl: input.url.trim(),
      title,
      snippet: cleanText(input.snippet).slice(0, SNIPPET_MAX_LENGTH) || null,
      publishedAt,
      sourceName: input.sourceName.trim() || hostOf(input.url),
      origin: "MANUAL",
      titleHash: computeTitleHash(title),
    },
    select: { id: true },
  });
  const sortOrder = await prisma.newsletterIssueArticle.count({ where: { issueId: issue.id } });
  await prisma.newsletterIssueArticle.upsert({
    where: { issueId_articleId: { issueId: issue.id, articleId: article.id } },
    create: { issueId: issue.id, articleId: article.id, ruleScore: 100, isSelected: true, sortOrder },
    update: { isSelected: true },
  });
  revalidatePath(`${BASE_PATH}/${campaignId}/articles`);
  return { success: true, issueId: issue.id };
}
