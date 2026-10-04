/**
 * safe-fetch.ts — 관리자 등록 외부 URL(RSS)을 SSRF 가드와 함께 가져온다.
 * [홍보팀] 등록된 언론사 RSS 주소만 안전하게 읽어오는 장치입니다. 내부망 주소로 우회하는 요청은 막습니다.
 * 국내 언론사 RSS 일부가 EUC-KR이라 charset을 직접 판별해 디코딩한다.
 */
import { isSafeFeedUrl } from "@/lib/url-safety";

export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export class UnsafeUrlError extends Error {}

const MAX_REDIRECTS = 2;
const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const USER_AGENT = "CoreDXI-NewsletterBot/1.0 (+https://www.coredxi.com)";

export function detectCharset(bytes: Uint8Array, contentType: string | null): string {
  const fromHeader = contentType?.match(/charset=["']?([\w-]+)/i)?.[1];
  if (fromHeader) return fromHeader.toLowerCase();
  const head = new TextDecoder("latin1").decode(bytes.slice(0, 200));
  const fromXml = head.match(/encoding=["']([\w-]+)["']/i)?.[1];
  return (fromXml ?? "utf-8").toLowerCase();
}

export function decodeFeedBody(bytes: Uint8Array, contentType: string | null): string {
  const charset = detectCharset(bytes, contentType);
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

export async function safeFetchText(url: string, opts: { fetchImpl?: FetchLike } = {}): Promise<string> {
  const fetchImpl: FetchLike = opts.fetchImpl ?? fetch;
  let current = url;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isSafeFeedUrl(current)) throw new UnsafeUrlError(`허용되지 않은 URL입니다: ${current}`);

    const res = await fetchImpl(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.5",
      },
      cache: "no-store",
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new Error(`리다이렉트 응답에 location이 없습니다 (${res.status})`);
      current = new URL(location, current).toString();
      continue;
    }
    if (!res.ok) throw new Error(`피드 요청 실패: HTTP ${res.status}`);

    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > MAX_BYTES) throw new Error("피드 응답이 너무 큽니다(2MB 초과)");
    return decodeFeedBody(new Uint8Array(buffer), res.headers.get("content-type"));
  }
  throw new Error("리다이렉트가 너무 많습니다");
}
