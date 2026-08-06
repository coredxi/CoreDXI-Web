/**
 * [홍보팀] OG 이미지 배경(블로그 커버·성공사례 썸네일) 로드 로직.
 * 렌더(og-image.tsx)와 판단 로직을 분리해 네트워크 호출 없이 유닛 테스트할 수 있도록 한다.
 */

const FETCH_TIMEOUT_MS = 3000;

/**
 * 배경 이미지 URL을 서버에서 fetch해 data URI로 변환한다.
 * 타임아웃·404·비이미지 응답 등 어떤 실패든 예외를 삼키고 null을 반환한다 —
 * OG 이미지 라우트가 500을 반환하면 공유 카드 자체가 깨지므로, 실패는 항상 배지형 폴백으로 이어져야 한다.
 */
export async function loadOgBackgroundDataUri(
  url: string,
  timeoutMs = FETCH_TIMEOUT_MS
): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) return null;

    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

type DecideOgBackgroundInput = {
  backgroundImageUrl?: string | null;
  isAllowedUrl: boolean;
  dataUri: string | null;
};

/**
 * 최종적으로 합성형(배경 있음) vs 배지형(폴백) 중 무엇을 렌더할지 결정하는 순수 함수.
 * URL 부재 → 배지형, URL 검증 실패(SSRF 방지) → 배지형, 로드 실패 → 배지형.
 */
export function decideOgBackgroundDataUri({
  backgroundImageUrl,
  isAllowedUrl,
  dataUri,
}: DecideOgBackgroundInput): string | null {
  if (!backgroundImageUrl) return null;
  if (!isAllowedUrl) return null;
  return dataUri;
}
