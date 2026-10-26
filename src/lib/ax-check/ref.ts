/**
 * ref.ts — AX 체크 유입 경로(ref 코드) 검증·보관·부여 유틸
 *
 * [홍보팀] 영업 링크(`/ax-check?ref=sales-kim`)나 블로그 글 CTA(`ref=blog-글주소`)로 들어온 방문자가
 * AX 체크까지 이어지는지 /admin/leads에서 ref별로 확인하기 위한 장치입니다.
 * 블로그 본문의 /ax-check 링크에는 ref가 자동으로 붙으므로 글 작성 시 직접 넣지 않아도 됩니다.
 * 설계: docs/superpowers/specs/2026-10-26-blog-attribution-design.md
 */

// 블로그 slug가 최대 72자(+중복 접미사)라 "blog-" 접두어를 붙여도 들어가도록 80자로 둔다.
export const REF_MAX_LENGTH = 80;
const REF_PATTERN = new RegExp(`^[a-z0-9-]{1,${REF_MAX_LENGTH}}$`);

/** 탭(세션) 단위로 최초 유입 ref를 보관하는 sessionStorage 키 */
export const FIRST_REF_STORAGE_KEY = "coredxi:first-ref";

/** 허용 패턴(영소문자·숫자·하이픈, 80자 이내)에 맞으면 소문자로 정규화해 반환, 아니면 null */
export function normalizeRefCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return REF_PATTERN.test(normalized) ? normalized : null;
}

/**
 * 우선순위: URL의 ref > 세션에 보관된 최초 ref.
 * 단, URL ref가 블로그 CTA가 자동으로 붙인 blog-*이면 최초 유입 ref(예: 영업 링크)를 우선한다 —
 * 영업 링크로 들어와 블로그를 읽고 CTA를 누른 방문자를 영업 성과로 집계하기 위함(2026-10-26).
 */
export function resolveRefCode(urlRef: unknown, storedRef: unknown): string | null {
  const url = normalizeRefCode(urlRef);
  const stored = normalizeRefCode(storedRef);
  if (url && isBlogRef(url) && stored) return stored;
  return url ?? stored;
}

type RefStorage = Pick<Storage, "getItem" | "setItem">;

/** 저장소 접근이 막혀 있어도(사파리 프라이빗 모드 등) 예외 없이 null을 돌려준다. */
export function readStoredRef(storage: RefStorage | null | undefined): string | null {
  try {
    return normalizeRefCode(storage?.getItem(FIRST_REF_STORAGE_KEY));
  } catch {
    return null;
  }
}

/** 최초 ref만 보관한다(이미 보관된 값이 있으면 덮어쓰지 않음). 저장 실패는 무시한다. */
export function storeFirstRef(storage: RefStorage | null | undefined, ref: unknown): void {
  const normalized = normalizeRefCode(ref);
  if (!normalized || !storage) return;
  try {
    if (readStoredRef(storage)) return;
    storage.setItem(FIRST_REF_STORAGE_KEY, normalized);
  } catch {
    // 저장소를 못 써도 AX 체크는 URL ref만으로 정상 동작해야 한다.
  }
}

/** 블로그 글 slug → `blog-{slug}` ref (허용 패턴에 맞게 정리·길이 제한) */
export function blogRefCode(slug: string): string {
  const cleaned = slug
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `blog-${cleaned}`.slice(0, REF_MAX_LENGTH).replace(/-+$/, "");
}

const SITE_ORIGIN = "https://www.coredxi.com";
const SITE_HOSTS = new Set(["coredxi.com", "www.coredxi.com"]);

/**
 * /ax-check로 가는 링크에 ref가 없으면 `ref=blog-{slug}`를 붙인다.
 * 작성자가 이미 ref를 넣었거나, 다른 페이지·외부 사이트 링크면 그대로 돌려준다.
 */
export function withBlogRef(href: string, slug: string): string {
  const isRelative = href.startsWith("/") && !href.startsWith("//");
  let url: URL;
  try {
    url = new URL(href, SITE_ORIGIN);
  } catch {
    return href;
  }

  if (!isRelative && !SITE_HOSTS.has(url.hostname)) return href;
  if (url.pathname !== "/ax-check" && url.pathname !== "/ax-check/") return href;
  if (url.searchParams.has("ref")) return href;

  url.searchParams.set("ref", blogRefCode(slug));
  return isRelative ? `${url.pathname}${url.search}${url.hash}` : url.toString();
}

// ---------------------------------------------------------------------------
// /admin/leads ref 필터 — "전체 / 블로그 묶음(blog-*) / ref 없음 / 개별 ref"
// ---------------------------------------------------------------------------

export const REF_FILTER_ALL = "all";
export const REF_FILTER_BLOG = "blog";
export const REF_FILTER_NONE = "none";
const REF_FILTER_CODE_PREFIX = "ref:";

export type RefFilterOption = { value: string; label: string; count: number };

function isBlogRef(refCode: string | null): boolean {
  return Boolean(refCode?.startsWith("blog-"));
}

export function matchesRefFilter(refCode: string | null, filter: string): boolean {
  if (filter === REF_FILTER_ALL) return true;
  if (filter === REF_FILTER_BLOG) return isBlogRef(refCode);
  if (filter === REF_FILTER_NONE) return !refCode;
  return refCode === filter.slice(REF_FILTER_CODE_PREFIX.length);
}

/** 리드 목록의 refCode로 필터 선택지와 건수를 만든다(개별 ref는 건수 내림차순). */
export function buildRefFilterOptions(refCodes: (string | null)[]): RefFilterOption[] {
  const counts = new Map<string, number>();
  for (const code of refCodes) {
    if (code) counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  const blogCount = refCodes.filter(isBlogRef).length;
  const noneCount = refCodes.filter((code) => !code).length;

  const options: RefFilterOption[] = [
    { value: REF_FILTER_ALL, label: "전체", count: refCodes.length },
  ];
  if (blogCount > 0) {
    options.push({ value: REF_FILTER_BLOG, label: "블로그 전체 (blog-*)", count: blogCount });
  }
  if (noneCount > 0) {
    options.push({ value: REF_FILTER_NONE, label: "ref 없음 (직접 유입)", count: noneCount });
  }
  const individual = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  for (const [code, count] of individual) {
    options.push({ value: `${REF_FILTER_CODE_PREFIX}${code}`, label: code, count });
  }
  return options;
}
