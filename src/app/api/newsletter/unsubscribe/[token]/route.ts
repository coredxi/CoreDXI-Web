// [홍보팀] 메일 앱(Gmail·네이버 등)의 "구독 취소" 버튼이 호출하는 원클릭 수신거부 주소(RFC 8058, 2026-10-20).
// POST(본문 "List-Unsubscribe=One-Click")일 때만 해지한다. 같은 주소를 GET으로 열면(보안 검사기·사람 클릭)
// 해지하지 않고 확인 화면 /unsubscribe/{token}으로 보낸다.
import { NextResponse } from "next/server";
import { unsubscribeNewsletterByToken } from "@/actions/newsletter";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";
import { ONE_CLICK_POST_VALUE } from "@/lib/newsletter-unsubscribe";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ token: string }> };

async function hasOneClickBody(request: Request): Promise<boolean> {
  try {
    const body = await request.text();
    // application/x-www-form-urlencoded("List-Unsubscribe=One-Click")와 multipart 모두 허용
    return body.includes(ONE_CLICK_POST_VALUE);
  } catch {
    return false;
  }
}

export async function POST(request: Request, { params }: Context) {
  const { token } = await params;

  // 메일 사업자 서버(같은 IP)에서 여러 구독자의 요청이 몰릴 수 있어 한도를 넉넉히 둔다.
  // 토큰은 192비트 랜덤이라 추측 공격 방어가 아니라 DB 남용 방지 목적.
  const clientIp = await getClientIp();
  const rateLimit = await checkRateLimit(`newsletter-one-click:${clientIp}`, {
    max: 60,
    windowMs: 10 * 60 * 1000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too Many Requests" },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  if (!(await hasOneClickBody(request))) {
    return NextResponse.json({ ok: false, error: "Invalid one-click request" }, { status: 400 });
  }

  const result = await unsubscribeNewsletterByToken(token);
  if (!result.success) {
    return NextResponse.json({ ok: false }, { status: result.code === "invalid_token" ? 404 : 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function GET(request: Request, { params }: Context) {
  const { token } = await params;
  const target = new URL(`/unsubscribe/${encodeURIComponent(token)}`, request.url);
  return NextResponse.redirect(target, 303);
}
