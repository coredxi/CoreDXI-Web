// [홍보팀] AX 체크 T1(상세 진단) 팔로업 발송 크론 라우트.
// Vercel Cron이 매일 정해진 시각에 이 엔드포인트를 호출해 예약된 팔로업 메일을 발송한다.
// CRON_SECRET Bearer 토큰으로 보호된다 — 헤더가 없거나 틀리거나, 시크릿 자체가
// 설정되지 않은 경우 모두 401을 반환하고 발송 로직(processDueFollowups)은 호출하지 않는다.
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { processDueFollowups } from "@/lib/ax-check/followup";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;

  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const result = await processDueFollowups();

  if (result.failed > 0) {
    Sentry.captureMessage(`ax-check followup: ${result.failed} failed`, "warning");
  }

  return NextResponse.json({ ok: true, ...result, ranAt: new Date().toISOString() });
}
