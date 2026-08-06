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
