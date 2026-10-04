/**
 * seed-news-sources.ts — 매체 시드 CSV → NewsSource upsert(이름 기준).
 *
 * 실행: npx tsx scripts/seed-news-sources.ts [csv경로] [--dry-run]
 *   기본 경로: docs/superpowers/assets/newsletter/news-sources.csv
 * CSV 헤더: name,category,homepage,rssUrl,domain,trustWeight,isActive (값에 쉼표 금지)
 * rssUrl은 isSafeFeedUrl(https·공개 호스트)을 통과해야 저장되고, 아니면 null로 저장 후 경고한다
 * — 설계 9절 "등록 시점 SSRF 검사"를 이 스크립트가 담당한다(1단계엔 매체 등록 화면 없음).
 * --dry-run은 prisma를 import하지도 않으므로 DB에 접속하지 않는다.
 * 패턴: scripts/publish-blog-drafts.ts (dotenv → main()에서 src/lib 동적 import → $disconnect)
 */
import { readFileSync } from "fs";
import { config } from "dotenv";

config({ path: ".env" });

const DEFAULT_CSV = "docs/superpowers/assets/newsletter/news-sources.csv";

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const csvPath = args.find((a) => !a.startsWith("--")) ?? DEFAULT_CSV;

  const { isSafeFeedUrl } = await import("../src/lib/url-safety");
  const prisma = dryRun ? null : (await import("../src/lib/prisma")).prisma;

  const [header, ...lines] = readFileSync(csvPath, "utf8").replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  const cols = header.split(",").map((c) => c.trim());
  const expected = ["name", "category", "homepage", "rssUrl", "domain", "trustWeight", "isActive"];
  if (cols.join(",") !== expected.join(",")) throw new Error(`CSV 헤더가 다릅니다: ${cols.join(",")}`);

  for (const [i, line] of lines.entries()) {
    const v = line.split(",").map((c) => c.trim());
    if (v.length !== expected.length) {
      console.warn(`[skip] ${i + 2}행: 열 개수 ${v.length}`);
      continue;
    }
    const [name, category, homepage, rssRaw, domainRaw, trustRaw, activeRaw] = v;
    const rssUrl = rssRaw && isSafeFeedUrl(rssRaw) ? rssRaw : null;
    if (rssRaw && !rssUrl) console.warn(`[warn] ${name}: RSS URL이 안전 검사에 실패해 비웁니다 (${rssRaw})`);
    const data = {
      name,
      category,
      homepage,
      rssUrl,
      domain: domainRaw.toLowerCase().replace(/^(www|m)\./, ""),
      trustWeight: Math.min(5, Math.max(1, Number(trustRaw) || 3)),
      isActive: activeRaw !== "false",
    };
    console.log(`${dryRun ? "[dry-run] " : ""}${data.name} (${data.domain}) rss=${data.rssUrl ? "Y" : "N"} trust=${data.trustWeight}`);
    if (prisma) await prisma.newsSource.upsert({ where: { name }, create: data, update: data });
  }

  if (prisma) await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
