// [홍보팀] 뉴스레터 기사 수집 크론 — 매일 06:00 KST(Vercel Cron "0 21 * * *")에 활성 캠페인의 기사를 모아
// 이번 호 초안에 후보로 붙인다. CRON_SECRET Bearer 토큰으로 보호(없거나 틀리면 401, 수집 안 함).
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { collectCampaign, type CollectResult } from "@/lib/newsletter/collect/collect-campaign";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const campaigns = await prisma.newsletterCampaign.findMany({
    where: {
      isActive: true,
      isDraft: false,
      sendType: { not: "IMMEDIATE" },
      activeFrom: { lte: now },
      OR: [{ activeUntil: null }, { activeUntil: { gte: now } }],
    },
    select: { id: true },
  });

  const results: (CollectResult | { campaignId: string; errors: string[] })[] = [];
  for (const { id } of campaigns) {
    try {
      const r = await collectCampaign(id, { now });
      results.push(r);
      if (r.errors.length > 0) {
        Sentry.captureMessage(`newsletter collect ${id}: ${r.errors.join(" / ")}`, "warning");
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      results.push({ campaignId: id, errors: [message] });
      Sentry.captureMessage(`newsletter collect ${id} crashed: ${message}`, "error");
    }
  }

  return NextResponse.json({ ok: true, results, ranAt: now.toISOString() });
}
