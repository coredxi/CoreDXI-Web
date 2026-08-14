/**
 * publish-blog-drafts.ts — ../blog-drafts/*.md 초안을 BlogPost(DRAFT)로 일괄 등록.
 *
 * 실행: npx tsx scripts/publish-blog-drafts.ts [--dir <path>] [--only 01,02] [--dry-run]
 *
 * - 항상 status: "DRAFT"로만 생성한다(발행 자동화 아님). CONTENT_GUIDE.md 16번·
 *   액션플랜 3-2 체크리스트가 요구하는 "발행 전 사람이 자체 검수" 단계를 그대로
 *   남겨두기 위한 의도적 설계다 — 사람은 /admin/blog에서 확인 후 발행 버튼만 누르면 된다.
 * - 마크다운→Tiptap JSON 변환은 src/lib/markdown-to-tiptap.ts, 섹션·커버 이미지는
 *   src/lib/blog-card-image.ts(둘 다 신규 의존성 없이 자체 구현). 이미지는 Supabase
 *   blog-images 버킷에 SVG로 업로드한다.
 * - scripts/backfill-portfolio-slugs.ts와 동일한 패턴: dotenv → main() 안에서
 *   src/lib/* 동적 import → prisma.$disconnect().
 *
 * 설계: docs/superpowers/plans(플랜 파일 "블로그 초안 4편 — 이미지·표 보강 + 원클릭 등록 스크립트")
 */
import { readFileSync, readdirSync } from "fs";
import path from "path";
import { config } from "dotenv";

config({ path: ".env" });

const DEFAULT_DRAFTS_DIR = path.resolve(process.cwd(), "..", "blog-drafts");
const CATEGORY_NAME = "AI 실무 활용";
const CATEGORY_DESCRIPTION = "AI 도구를 실제 업무에 활용한 CoreDXI 팀의 실전 사례를 다룹니다.";
const MAX_SECTION_IMAGES = 6;

type CliOptions = {
  dir: string;
  only: string[] | null;
  dryRun: boolean;
};

function parseArgs(argv: string[]): CliOptions {
  let dir = DEFAULT_DRAFTS_DIR;
  let only: string[] | null = null;
  let dryRun = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dir") {
      dir = path.resolve(argv[i + 1] ?? DEFAULT_DRAFTS_DIR);
      i += 1;
    } else if (arg === "--only") {
      only = (argv[i + 1] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      i += 1;
    } else if (arg === "--dry-run") {
      dryRun = true;
    }
  }

  return { dir, only, dryRun };
}

type DraftMeta = {
  fileName: string;
  title: string;
  slugHint: string | null;
  excerpt: string;
  categoryName: string;
  bodyMarkdown: string;
};

function extractMetaValue(metaBlock: string, label: string): string | null {
  const pattern = new RegExp(`-\\s+\\*\\*${label}\\*\\*:\\s*(.+)`);
  const match = pattern.exec(metaBlock);
  return match ? match[1].trim() : null;
}

/**
 * blog-drafts/NN-*.md 파일에서 "## 메타 정보" 블록과 "## 본문 (재가공 완료본...)"
 * 섹션(다음 "^## " 줄 전까지)을 추출한다.
 */
function parseDraftFile(filePath: string): DraftMeta | null {
  const raw = readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/);

  const metaStart = lines.findIndex((l) => l.trim() === "## 메타 정보");
  const bodyStart = lines.findIndex((l) => l.trim().startsWith("## 본문"));
  if (metaStart === -1 || bodyStart === -1) return null;

  let metaEnd = lines.findIndex((l, i) => i > metaStart && /^##\s/.test(l));
  if (metaEnd === -1 || metaEnd > bodyStart) metaEnd = bodyStart;
  const metaBlock = lines.slice(metaStart + 1, metaEnd).join("\n");

  let bodyEnd = lines.findIndex((l, i) => i > bodyStart && /^##\s/.test(l));
  if (bodyEnd === -1) bodyEnd = lines.length;
  let bodyLines = lines.slice(bodyStart + 1, bodyEnd);
  // 본문 섹션 끝의 트레일링 "---" + 빈 줄 정리
  while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1].trim() === "") {
    bodyLines = bodyLines.slice(0, -1);
  }
  if (bodyLines.length > 0 && bodyLines[bodyLines.length - 1].trim() === "---") {
    bodyLines = bodyLines.slice(0, -1);
  }

  const title = extractMetaValue(metaBlock, "제목\\(안\\)");
  const excerpt = extractMetaValue(metaBlock, "요약\\(안\\)");
  const slugHint = extractMetaValue(metaBlock, "슬러그\\(안\\)");

  if (!title || !excerpt) return null;

  // 카테고리는 draft별 제안값을 자동 신뢰하지 않고, 이번 4편 공통으로 CATEGORY_NAME 하나로 고정한다
  // (00-README.md 카테고리 제안 근거 참고). 향후 draft가 다른 카테고리를 쓰게 되면 이 필드를 실제로 읽도록 확장.
  return {
    fileName: path.basename(filePath),
    title,
    slugHint,
    excerpt,
    categoryName: CATEGORY_NAME,
    bodyMarkdown: bodyLines.join("\n"),
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  const { prisma } = await import("../src/lib/prisma");
  const { uniqueSlug } = await import("../src/lib/blog-slug");
  const { slugifyCategoryName, uniqueCategorySlug } = await import("../src/lib/blog-category-slug");
  const { uploadBufferToBlogImages } = await import("../src/lib/blog-image-storage");
  const { parseDraftMarkdownToDoc } = await import("../src/lib/markdown-to-tiptap");
  const { renderCoverCardSvg, renderSectionCardSvg } = await import("../src/lib/blog-card-image");

  if (!opts.dryRun) {
    const missing = [
      !process.env.DATABASE_URL && "DATABASE_URL",
      !process.env.NEXT_PUBLIC_SUPABASE_URL && "NEXT_PUBLIC_SUPABASE_URL",
      !process.env.SUPABASE_SERVICE_ROLE_KEY && "SUPABASE_SERVICE_ROLE_KEY",
    ].filter(Boolean);
    if (missing.length > 0) {
      console.error(`환경 변수 누락: ${missing.join(", ")} — .env를 확인하세요.`);
      process.exit(1);
    }
  }

  const files = readdirSync(opts.dir)
    .filter((f) => /^\d{2}-.*\.md$/.test(f))
    .filter((f) => !opts.only || opts.only.some((prefix) => f.startsWith(prefix)))
    .sort();

  if (files.length === 0) {
    console.error(`대상 마크다운 파일이 없습니다: ${opts.dir}`);
    process.exit(1);
  }

  console.log(`대상 폴더: ${opts.dir}`);
  console.log(`대상 파일: ${files.join(", ")}`);
  console.log(opts.dryRun ? "모드: dry-run (업로드·DB 쓰기 없음)\n" : "모드: 실제 등록(DRAFT)\n");

  let categoryId: string | null = null;
  let categorySlugForLog = "";

  if (!opts.dryRun) {
    const existing = await prisma.blogCategory.findFirst({ where: { name: CATEGORY_NAME } });
    if (existing) {
      categoryId = existing.id;
      categorySlugForLog = existing.slug;
    } else {
      const slug = await uniqueCategorySlug(slugifyCategoryName(CATEGORY_NAME), async (s: string) => {
        const row = await prisma.blogCategory.findUnique({ where: { slug: s } });
        return row !== null;
      });
      const created = await prisma.blogCategory.create({
        data: { name: CATEGORY_NAME, slug, description: CATEGORY_DESCRIPTION, sortOrder: 10 },
      });
      categoryId = created.id;
      categorySlugForLog = created.slug;
      console.log(`카테고리 생성: "${CATEGORY_NAME}" (slug: ${slug})`);
    }
  }

  const results: { file: string; title: string; slug: string; status: string; images: number }[] = [];

  for (const file of files) {
    const filePath = path.join(opts.dir, file);
    const draft = parseDraftFile(filePath);
    if (!draft) {
      console.warn(`⚠️  파싱 실패, 건너뜀: ${file} ("## 메타 정보"/"## 본문" 섹션 확인 필요)`);
      continue;
    }

    const { doc, sections } = parseDraftMarkdownToDoc(draft.bodyMarkdown);

    // 슬러그: 메타의 슬러그(안) 우선, 없으면 제목 기반 자동 생성
    let slug: string;
    if (!opts.dryRun) {
      const isTaken = async (s: string) => (await prisma.blogPost.findUnique({ where: { slug: s } })) !== null;
      if (draft.slugHint) {
        let candidate = draft.slugHint;
        let n = 0;
        while (await isTaken(candidate)) {
          n += 1;
          candidate = `${draft.slugHint}-${n}`;
        }
        slug = candidate;
      } else {
        slug = await uniqueSlug(draft.title, isTaken);
      }
    } else {
      slug = draft.slugHint ?? "(dry-run 중 계산 생략)";
    }

    // 동일 제목 게시글이 이미 있으면 건너뛴다(재실행 안전성)
    if (!opts.dryRun) {
      const dup = await prisma.blogPost.findFirst({ where: { title: draft.title } });
      if (dup) {
        console.log(`⏭️  이미 존재해 건너뜀: "${draft.title}" (기존 slug: ${dup.slug})`);
        results.push({ file, title: draft.title, slug: dup.slug, status: "skipped(exists)", images: 0 });
        continue;
      }
    }

    let coverImageUrl: string | null = null;
    let imageCount = 0;

    if (!opts.dryRun) {
      const coverSvg = renderCoverCardSvg({
        title: draft.title,
        subtitle: draft.excerpt,
        badge: CATEGORY_NAME,
      });
      const cover = await uploadBufferToBlogImages(Buffer.from(coverSvg, "utf8"), {
        prefix: `blog/${slug}/cover`,
        contentType: "image/svg+xml",
        ext: "svg",
      });
      coverImageUrl = cover.publicUrl;
      imageCount += 1;

      // 섹션마다 이미지 노드를 heading 바로 뒤에 삽입 (최대 MAX_SECTION_IMAGES장)
      const docContent = doc.content ?? [];
      const nextContent: typeof docContent = [];
      let sectionIndex = 0;
      for (const node of docContent) {
        nextContent.push(node);
        if (node.type === "heading" && node.attrs?.level === 3) {
          const section = sections[sectionIndex];
          sectionIndex += 1;
          if (section && imageCount - 1 < MAX_SECTION_IMAGES) {
            const sectionSvg = renderSectionCardSvg({
              eyebrow: `Section ${sectionIndex.toString().padStart(2, "0")}`,
              title: section.heading,
              highlight: section.highlight,
            });
            const uploaded = await uploadBufferToBlogImages(Buffer.from(sectionSvg, "utf8"), {
              prefix: `blog/${slug}/sections`,
              contentType: "image/svg+xml",
              ext: "svg",
            });
            nextContent.push({
              type: "image",
              attrs: { src: uploaded.publicUrl, alt: section.heading },
            });
            imageCount += 1;
          }
        }
      }
      doc.content = nextContent;
    }

    if (opts.dryRun) {
      console.log(`--- ${file} ---`);
      console.log(`  제목: ${draft.title}`);
      console.log(`  슬러그(안): ${draft.slugHint ?? "(없음 → 자동 생성 예정)"}`);
      console.log(`  본문 블록 수: ${doc.content?.length ?? 0}, 섹션 수: ${sections.length}`);
      console.log(`  생성 예정 이미지: 커버 1 + 섹션 최대 ${Math.min(sections.length, MAX_SECTION_IMAGES)}`);
      results.push({ file, title: draft.title, slug, status: "dry-run", images: 0 });
      continue;
    }

    const created = await prisma.blogPost.create({
      data: {
        slug,
        title: draft.title,
        excerpt: draft.excerpt,
        coverImageUrl,
        content: JSON.parse(JSON.stringify(doc)) as import("../src/generated/prisma/client").Prisma.InputJsonValue,
        categoryId: categoryId!,
        status: "DRAFT",
        publishedAt: null,
      },
    });

    console.log(`✅ DRAFT 생성: "${created.title}" → /blog/${created.slug} (이미지 ${imageCount}장)`);
    results.push({ file, title: draft.title, slug: created.slug, status: "created(DRAFT)", images: imageCount });
  }

  console.log("\n=== 요약 ===");
  console.table(results);
  if (!opts.dryRun) {
    console.log(`카테고리: "${CATEGORY_NAME}" (slug: ${categorySlugForLog})`);
    console.log("다음 단계: /admin/blog 에서 각 글을 열어 렌더링을 확인하고, CONTENT_GUIDE.md 16번 자체검수 후 '발행'을 눌러주세요.");
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
