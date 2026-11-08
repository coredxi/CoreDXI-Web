// [홍보팀] 뉴스레터 예약 발송 크론 — 매일 08:00 KST(Vercel Cron "0 23 * * *")에 승인되고 예약 시각이 지난 호를 보낸다.
// Hobby 플랜은 크론이 하루 1회라 예약 시각은 사실상 "그날 08시 슬롯"으로 동작한다. CRON_SECRET Bearer 보호.
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { processDueIssues } from "@/lib/newsletter/send";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const result = await processDueIssues();
  if (result.failed > 0 || result.recovered > 0) {
    Sentry.captureMessage(
      `newsletter send: ${result.failed} failed, ${result.recovered} recovered`,
      "warning"
    );
  }
  return NextResponse.json({ ok: true, ...result, ranAt: new Date().toISOString() });
}
