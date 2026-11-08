/**
 * ax-weekly.ts — "AX 위클리" 뉴스레터 메일 양식(HTML + 텍스트)
 * [홍보팀] 메일에 보이는 문구(CTA 문장, 푸터 안내)는 아래 COPY 상수에서 고칠 수 있습니다.
 * 수신거부 링크는 받는 사람마다 다르므로 {{UNSUBSCRIBE_URL}} 자리표시자로 두고 발송 직전에 바꿉니다.
 * 설계: docs/superpowers/specs/2026-09-28-newsletter-distribution-design.md 8절
 */
import { SALES_SIGNATURE, escapeHtml, getEmailLogoUrl } from "@/lib/ax-check/catalog";
import { formatKstYmd } from "../schedule";
import { ensureAdPrefix } from "../subject";
import { SITE_URL } from "@/lib/seo";

export const UNSUBSCRIBE_PLACEHOLDER = "{{UNSUBSCRIBE_URL}}";

/** 메일 속 모든 자사 링크(CTA·수신거부·로고)의 기준 주소 — 프리뷰 배포에서 보내도 운영 도메인으로 고정. */
export const NEWSLETTER_SITE_ORIGIN = SITE_URL.replace(/\/+$/, "");

const COPY = {
  ctaLead: "우리 회사 AX 우선과제, 3분이면 진단됩니다.",
  ctaButton: "AX 우선과제 3분 진단 받기 →",
  reason: "이 메일은 coredxi.com 뉴스레터 구독 신청에 따라 발송됩니다.",
  unsubscribe: "수신거부",
  company: "(주)코어디엑스아이",
} as const;

export type AxWeeklyArticle = {
  title: string;
  url: string;
  sourceName: string | null;
  publishedAt: Date;
  summary: string | null;
  snippet: string | null;
  editorNote: string | null;
};

export type AxWeeklyInput = {
  issueNo: number;
  issueDate: Date;
  subject: string;
  intro: string | null;
  articles: AxWeeklyArticle[];
  siteUrl?: string;
};

function isHttpUrl(url: string): boolean {
  try {
    const p = new URL(url).protocol;
    return p === "http:" || p === "https:";
  } catch {
    return false;
  }
}

export function withNewsletterUtm(url: string, issueNo: number, siteUrl: string): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  if (u.hostname !== new URL(siteUrl).hostname) return url;
  u.searchParams.set("utm_source", "newsletter");
  u.searchParams.set("utm_medium", "email");
  u.searchParams.set("utm_campaign", "ax-weekly");
  u.searchParams.set("utm_content", `issue-${issueNo}`);
  return u.toString();
}

export function renderAxWeekly(input: AxWeeklyInput): { subject: string; html: string; text: string } {
  const siteUrl = (input.siteUrl ?? NEWSLETTER_SITE_ORIGIN).replace(/\/+$/, "");
  const dateLabel = formatKstYmd(input.issueDate);
  const ctaUrl = withNewsletterUtm(`${siteUrl}/ax-check?ref=newsletter`, input.issueNo, siteUrl);
  const address = SALES_SIGNATURE.addresses[0];

  const articleHtml = input.articles
    .map((a) => {
      const meta = [a.sourceName, formatKstYmd(a.publishedAt)].filter(Boolean).join(" · ");
      const title = escapeHtml(a.title);
      const titleHtml = isHttpUrl(a.url)
        ? `<a href="${escapeHtml(a.url)}" style="color:#1E4E8C;font-weight:bold;text-decoration:none;">${title}</a>`
        : `<span style="font-weight:bold;">${title}</span>`;
      const body = a.summary ?? a.snippet;
      return [
        '<div style="border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin:0 0 12px;">',
        `<div style="font-size:12px;color:#6b7280;">${escapeHtml(meta)}</div>`,
        `<div style="font-size:16px;margin:4px 0 8px;">${titleHtml}</div>`,
        body ? `<div style="font-size:14px;color:#111111;">${escapeHtml(body)}</div>` : "",
        a.editorNote
          ? `<div style="font-size:13px;color:#1E4E8C;margin-top:8px;">▸ ${escapeHtml(a.editorNote)}</div>`
          : "",
        "</div>",
      ].join("");
    })
    .join("");

  const html = [
    '<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111111;max-width:600px;margin:0 auto;">',
    `<img src="${escapeHtml(getEmailLogoUrl())}" alt="CoreDXI" height="28" style="display:block;margin:16px 0;" />`,
    `<div style="font-size:13px;color:#6b7280;">AX 위클리 #${input.issueNo} · ${dateLabel}</div>`,
    input.intro ? `<p style="font-size:14px;white-space:pre-wrap;">${escapeHtml(input.intro)}</p>` : "",
    articleHtml,
    '<div style="background:#f3f6fb;border-radius:12px;padding:16px;margin:16px 0;text-align:center;">',
    `<div style="font-size:14px;margin-bottom:8px;">${COPY.ctaLead}</div>`,
    `<a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#1E4E8C;color:#ffffff;border-radius:12px;padding:10px 18px;text-decoration:none;font-weight:bold;">${COPY.ctaButton}</a>`,
    "</div>",
    '<div style="font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:12px;">',
    `${COPY.company} · ${escapeHtml(address)} · ${escapeHtml(SALES_SIGNATURE.email)}<br />`,
    `${COPY.reason} <a href="${UNSUBSCRIBE_PLACEHOLDER}" style="color:#6b7280;">${COPY.unsubscribe}</a>`,
    "</div>",
    "</div>",
  ].join("");

  const text = [
    `AX 위클리 #${input.issueNo} · ${dateLabel}`,
    input.intro ?? "",
    ...input.articles.map((a, i) =>
      [
        `${i + 1}. ${a.title}`,
        `   ${[a.sourceName, formatKstYmd(a.publishedAt)].filter(Boolean).join(" · ")}`,
        isHttpUrl(a.url) ? `   ${a.url}` : "",
        a.summary ?? a.snippet ? `   ${a.summary ?? a.snippet}` : "",
        a.editorNote ? `   ▸ ${a.editorNote}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    ),
    `${COPY.ctaLead}\n${ctaUrl}`,
    `${COPY.company} · ${address} · ${SALES_SIGNATURE.email}`,
    `${COPY.reason} ${COPY.unsubscribe}: ${UNSUBSCRIBE_PLACEHOLDER}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return { subject: ensureAdPrefix(input.subject), html, text };
}
