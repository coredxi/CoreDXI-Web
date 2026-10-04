/**
 * collect-campaign.ts — 캠페인 1개 수집: 검색·RSS → 정규화·중복 제거 → 저장 → 키워드 필터·규칙 점수 → 이번 호 후보 부착
 * [홍보팀] 매일 아침 자동으로 돌거나, 관리자 화면의 "지금 수집" 버튼으로 실행되는 부분입니다.
 * 설계: docs/superpowers/specs/2026-09-28-newsletter-distribution-design.md 6-1·6-2
 */
import { prisma } from "@/lib/prisma";
import { ensureCurrentIssue, type CampaignForIssue } from "../issues";
import { keywordHitRate, matchKeywords, pickQueryTerms } from "../keyword-filter";
import { SNIPPET_MAX_LENGTH, computeTitleHash, hostOf, matchSourceByDomain, normalizeUrl } from "../normalize";
import { computeRuleScore } from "../score-rules";
import type { CandidateArticle, KeywordInput } from "../types";
import { searchNaverNews } from "./naver-news";
import { fetchRssArticles } from "./rss";

export type CollectDeps = {
  searchNaver: (query: string) => Promise<CandidateArticle[]>;
  fetchRss: (url: string) => Promise<CandidateArticle[]>;
};

export type CollectResult = {
  campaignId: string;
  fetched: number;
  stored: number;
  matched: number;
  attached: number;
  issueId: string | null;
  errors: string[];
};

const DAY_MS = 86_400_000;
const FUTURE_TOLERANCE_MS = 3_600_000;

const DEFAULT_DEPS: CollectDeps = {
  searchNaver: (q) => searchNaverNews(q),
  fetchRss: (url) => fetchRssArticles(url),
};

type StoredArticle = {
  id: string;
  title: string;
  snippet: string | null;
  publishedAt: Date;
  trustWeight: number | null;
  dupCount: number;
};

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export async function collectCampaign(
  campaignId: string,
  opts: { now?: Date; deps?: CollectDeps } = {}
): Promise<CollectResult> {
  const now = opts.now ?? new Date();
  const deps = opts.deps ?? DEFAULT_DEPS;
  const result: CollectResult = { campaignId, fetched: 0, stored: 0, matched: 0, attached: 0, issueId: null, errors: [] };

  const campaign = await prisma.newsletterCampaign.findUnique({
    where: { id: campaignId },
    include: { keywords: true, sources: { include: { source: true } } },
  });
  if (!campaign) {
    result.errors.push("캠페인을 찾을 수 없습니다.");
    return result;
  }
  const keywords: KeywordInput[] = campaign.keywords.map((k) => ({
    group: k.group,
    operator: k.operator,
    term: k.term,
    weight: k.weight,
  }));

  // 1) 수집 — 실패한 경로는 errors에 남기고 나머지로 계속
  const jobs: { label: string; run: () => Promise<CandidateArticle[]> }[] = [
    ...pickQueryTerms(keywords).map((term) => ({ label: `네이버 "${term}"`, run: () => deps.searchNaver(term) })),
    ...campaign.sources
      .filter((cs) => cs.source.isActive && cs.source.rssUrl)
      .map((cs) => ({ label: `RSS ${cs.source.rssUrl}`, run: () => deps.fetchRss(cs.source.rssUrl as string) })),
  ];
  const settled = await Promise.allSettled(jobs.map((j) => j.run()));
  const raw: CandidateArticle[] = [];
  settled.forEach((s, i) => {
    if (s.status === "fulfilled") raw.push(...s.value);
    else result.errors.push(`${jobs[i].label}: ${errorMessage(s.reason)}`);
  });
  result.fetched = raw.length;

  // 2) 기간 필터 + URL 중복 제거 + 제목 해시로 전재 묶기(가장 이른 기사만, 묶음 크기=dupCount)
  const windowStart = now.getTime() - campaign.collectDays * DAY_MS;
  const byUrl = new Map<string, CandidateArticle & { urlNormalized: string; titleHash: string }>();
  for (const a of raw) {
    const t = a.publishedAt.getTime();
    if (t < windowStart || t > now.getTime() + FUTURE_TOLERANCE_MS) continue;
    const urlNormalized = normalizeUrl(a.originalUrl);
    if (!urlNormalized) continue;
    const prev = byUrl.get(urlNormalized);
    if (!prev || a.publishedAt < prev.publishedAt) {
      byUrl.set(urlNormalized, { ...a, urlNormalized, titleHash: computeTitleHash(a.title) });
    }
  }
  const byHash = new Map<string, { first: CandidateArticle & { urlNormalized: string; titleHash: string }; count: number }>();
  for (const a of byUrl.values()) {
    const g = byHash.get(a.titleHash);
    if (!g) byHash.set(a.titleHash, { first: a, count: 1 });
    else {
      g.count += 1;
      if (a.publishedAt < g.first.publishedAt) g.first = a;
    }
  }

  // 3) 저장 — DB에 같은 제목 해시가 이미 있으면 그 기사를 재사용(새 행 안 만듦)
  const sources = await prisma.newsSource.findMany({ select: { id: true, domain: true, trustWeight: true } });
  const existing = await prisma.newsArticle.findMany({
    where: { titleHash: { in: [...byHash.keys()] } },
    include: { source: true },
  });
  const existingByHash = new Map(existing.map((e) => [e.titleHash, e]));

  const stored: StoredArticle[] = [];
  for (const [hash, { first, count }] of byHash) {
    const prior = existingByHash.get(hash);
    if (prior) {
      stored.push({
        id: prior.id,
        title: prior.title,
        snippet: prior.snippet,
        publishedAt: prior.publishedAt,
        trustWeight: prior.source?.trustWeight ?? null,
        dupCount: count + 1,
      });
      continue;
    }
    const source = matchSourceByDomain(first.originalUrl, sources);
    const row = await prisma.newsArticle.upsert({
      where: { urlNormalized: first.urlNormalized },
      update: {},
      create: {
        urlNormalized: first.urlNormalized,
        originalUrl: first.originalUrl,
        title: first.title,
        snippet: first.snippet?.slice(0, SNIPPET_MAX_LENGTH) ?? null,
        publishedAt: first.publishedAt,
        sourceId: source?.id ?? null,
        sourceName: source ? null : hostOf(first.originalUrl),
        origin: first.origin,
        titleHash: hash,
      },
      include: { source: true },
    });
    result.stored += 1;
    stored.push({
      id: row.id,
      title: row.title,
      snippet: row.snippet,
      publishedAt: row.publishedAt,
      trustWeight: row.source?.trustWeight ?? null,
      dupCount: count,
    });
  }

  // 4) 키워드 필터 + 규칙 점수
  const scored = stored.flatMap((a) => {
    const match = matchKeywords(keywords, a.title, a.snippet ?? "");
    if (!match.passes) return [];
    const ruleScore = computeRuleScore({
      hitRate: keywordHitRate(match),
      publishedAt: a.publishedAt,
      now,
      collectDays: campaign.collectDays,
      trustWeight: a.trustWeight,
      dupCount: a.dupCount,
    });
    return [{ articleId: a.id, ruleScore }];
  });
  result.matched = scored.length;

  // 5) 이번 호 후보 부착 (관리자가 손댄 호는 건드리지 않음)
  const issue = await ensureCurrentIssue(campaign as CampaignForIssue, now);
  if (!issue) return result;
  result.issueId = issue.id;
  if (issue.editedAt) return result;

  const alreadySent = await prisma.newsletterIssueArticle.findMany({
    where: {
      articleId: { in: scored.map((s) => s.articleId) },
      isSelected: true,
      issue: { campaignId: campaign.id, status: "SENT" },
    },
    select: { articleId: true },
  });
  const sentIds = new Set(alreadySent.map((r) => r.articleId));

  const current = await prisma.newsletterIssueArticle.findMany({
    where: { issueId: issue.id },
    select: { articleId: true, ruleScore: true },
  });
  const merged = new Map(current.map((c) => [c.articleId, c.ruleScore]));
  for (const s of scored) if (!sentIds.has(s.articleId)) merged.set(s.articleId, s.ruleScore);

  const top = [...merged.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, campaign.maxArticles * 2);
  const topIds = top.map(([id]) => id);

  await prisma.$transaction([
    prisma.newsletterIssueArticle.deleteMany({ where: { issueId: issue.id, articleId: { notIn: topIds } } }),
    ...top.map(([articleId, ruleScore], index) => {
      const fields = { ruleScore, isSelected: index < campaign.maxArticles, sortOrder: index };
      return prisma.newsletterIssueArticle.upsert({
        where: { issueId_articleId: { issueId: issue.id, articleId } },
        create: { issueId: issue.id, articleId, ...fields },
        update: fields,
      });
    }),
  ]);
  await prisma.newsletterIssue.update({
    where: { id: issue.id },
    data: { status: top.length > 0 ? "DRAFT" : "COLLECTING" },
  });
  result.attached = top.length;
  return result;
}
