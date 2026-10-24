/**
 * 뉴스레터 수신거부 링크·헤더 규칙 (2026-10-20).
 * [홍보팀] 메일 하단 "수신거부"를 누르면 바로 해지되지 않고 확인 화면이 먼저 뜹니다.
 * 회사 메일의 보안 검사기가 링크를 미리 열어 보더라도 구독이 풀리지 않게 하기 위해서입니다.
 *
 * - 본문 링크: `/unsubscribe/{token}` — GET은 확인 화면만, 해지는 "구독 해지" 버튼(POST)으로만.
 * - 메일 헤더: RFC 8058 원클릭 — `List-Unsubscribe: <https://…/api/newsletter/unsubscribe/{token}>`
 *   + `List-Unsubscribe-Post: List-Unsubscribe=One-Click`. Gmail·네이버 등 메일 앱의 "구독 취소"
 *   버튼이 이 주소로 POST를 보내며, 같은 주소를 GET으로 열면 확인 화면으로 넘어갈 뿐 해지되지 않는다.
 */

export const ONE_CLICK_UNSUBSCRIBE_PATH = "/api/newsletter/unsubscribe";
export const ONE_CLICK_POST_VALUE = "List-Unsubscribe=One-Click";

function trimOrigin(origin: string): string {
  return origin.replace(/\/+$/, "");
}

/** 사람이 여는 확인 화면 주소(메일 본문·구독 완료 메일용). */
export function unsubscribePageUrl(origin: string, token: string): string {
  return `${trimOrigin(origin)}/unsubscribe/${encodeURIComponent(token)}`;
}

/** 메일 앱 "구독 취소" 버튼이 POST하는 원클릭 주소(List-Unsubscribe 헤더용). */
export function oneClickUnsubscribeUrl(origin: string, token: string): string {
  return `${trimOrigin(origin)}${ONE_CLICK_UNSUBSCRIBE_PATH}/${encodeURIComponent(token)}`;
}

/**
 * 수신거부 메일 헤더. https 주소일 때만 원클릭(List-Unsubscribe-Post)을 붙인다 —
 * 내부 시험 수신자처럼 mailto 주소만 있는 경우 POST 헤더는 의미가 없고 규격 위반이다.
 */
export function buildListUnsubscribeHeaders(url: string): Record<string, string> {
  const headers: Record<string, string> = { "List-Unsubscribe": `<${url}>` };
  if (url.startsWith("https://")) {
    headers["List-Unsubscribe-Post"] = ONE_CLICK_POST_VALUE;
  }
  return headers;
}

/** 확인 화면 표시용 이메일 가림(ab***@example.com). 링크만 가진 제3자에게 주소 전체를 보여주지 않는다. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${visible}***@${domain}`;
}
