/**
 * normalize.ts — 수집 기사 정규화(중복 제거 키·텍스트 정리·매체 매칭). 순수 함수.
 * [홍보팀] 같은 기사가 여러 매체·주소로 들어와도 한 번만 보이게 만드는 규칙입니다.
 * 설계: docs/superpowers/specs/2026-09-28-newsletter-distribution-design.md 6-1
 */
import { createHash } from "crypto";

export const SNIPPET_MAX_LENGTH = 200;

const TRACKING_PARAM = /^(utm_.*|fbclid|gclid|igshid|mc_cid|mc_eid)$/i;
const HOST_PREFIX = /^(www|m|mobile)\./;

export function normalizeUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;

  const kept = [...u.searchParams.entries()]
    .filter(([key]) => !TRACKING_PARAM.test(key))
    .sort(([a], [b]) => a.localeCompare(b));

  const host = u.hostname.toLowerCase().replace(HOST_PREFIX, "");
  const path = u.pathname.replace(/\/+$/, "") || "/";
  const query = kept.length
    ? `?${kept.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&")}`
    : "";
  return `https://${host}${path === "/" ? "" : path}${query}`;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  middot: "·",
  hellip: "…",
  lsquo: "'",
  rsquo: "'",
  ldquo: "“",
  rdquo: "”",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code.startsWith("#")) {
      const n =
        code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : match;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match;
  });
}

/** HTML 태그 제거 → 엔티티 디코딩 → 공백 정리. 결과는 "평문"이며 HTML로 쓸 때는 반드시 escapeHtml 1회. */
export function cleanText(s: string | null | undefined): string {
  if (!s) return "";
  return decodeEntities(s.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
}

export function normalizeTitle(title: string): string {
  const base = cleanText(title);
  const stripped = base
    .replace(/\[[^\]]*\]|【[^】]*】|\([^)]*\)/g, " ")
    .replace(/\s[-|–—]\s[^-|–—]{1,20}$/, " ")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
  // 말머리만 있는 제목처럼 정규화 결과가 비면 원문(공백 제거)으로 대체 — 빈 문자열 해시 충돌 방지
  return stripped || base.toLowerCase().replace(/\s+/g, "");
}

export function computeTitleHash(title: string): string {
  return createHash("sha1").update(normalizeTitle(title)).digest("hex").slice(0, 16);
}

export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(HOST_PREFIX, "");
  } catch {
    return null;
  }
}

export function matchSourceByDomain<T extends { domain: string }>(
  url: string,
  sources: readonly T[]
): T | null {
  const host = hostOf(url);
  if (!host) return null;
  return sources.find((s) => host === s.domain || host.endsWith(`.${s.domain}`)) ?? null;
}
