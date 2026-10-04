/** 사설/루프백/링크로컬 대역 호스트인지 확인 — 서버 사이드 외부 URL fetch 시 SSRF 방지용 */
export function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "::1" ||
    h.startsWith("192.168.") ||
    h.startsWith("10.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    h.endsWith(".internal") ||
    h.endsWith(".local")
  );
}

/**
 * [홍보팀] OG 이미지 배경으로 fetch해도 안전한 URL인지 검증한다.
 * https 프로토콜이고, 자사 Supabase Storage 호스트와 정확히 일치할 때만 허용한다(SSRF 방지).
 */
export function isAllowedOgBackgroundUrl(
  url: string,
  allowedHost: string | null
): boolean {
  if (!allowedHost) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return (
    parsed.protocol === "https:" &&
    parsed.hostname.toLowerCase() === allowedHost.toLowerCase()
  );
}

/** [홍보팀] NEXT_PUBLIC_SUPABASE_URL에서 Storage 호스트명을 파생한다 — 호스트를 코드에 직접 하드코딩하지 않기 위함. */
export function getSupabaseStorageHost(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return null;
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
}

/**
 * [홍보팀] 뉴스레터 RSS 피드처럼 관리자가 등록한 외부 URL을 서버가 가져가도 안전한지 검사한다.
 * https만 허용하고, 사설·루프백·링크로컬(클라우드 메타데이터)·CGNAT 대역, 정수형/IPv6 리터럴,
 * 계정정보가 포함된 URL은 모두 막는다(SSRF 방지). 등록 시점과 fetch 시점(리다이렉트 포함) 모두 호출한다.
 */
export function isSafeFeedUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (parsed.username || parsed.password) return false;

  const host = parsed.hostname.toLowerCase();
  if (host.startsWith("[") || host.includes(":")) return false; // IPv6 리터럴 전면 차단
  if (/^\d+$/.test(host)) return false; // 정수형 IP 표기
  if (isBlockedHost(host)) return false;
  if (/^(0\.|169\.254\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(host)) return false;
  return true;
}
