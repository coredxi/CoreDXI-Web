/**
 * blog-card-image.ts — 블로그 글 커버·섹션 이미지를 브랜드 톤 SVG로 생성.
 *
 * scripts/publish-blog-drafts.ts 전용 유틸. sharp/@vercel/og 등 신규 라스터 생성
 * 의존성을 추가하지 않고, 순수 SVG 문자열을 만들어 그대로 Supabase blog-images
 * 버킷에 업로드한다(ALLOWED_IMAGE_TYPES에 image/svg+xml 이미 포함 — src/lib/blog-image-storage.ts).
 * 브랜드 컬러(로열 블루 #1E4E8C)·라운드 코너(rounded-xl 상응) 규칙은 CLAUDE.md 5번을 따른다.
 *
 * 설계: docs/superpowers/plans(플랜 파일 "블로그 초안 4편 — 이미지·표 보강 + 원클릭 등록 스크립트")
 */

const WIDTH = 1200;
const HEIGHT = 630;
const BRAND_PRIMARY = "#1E4E8C";
const BRAND_DARK = "#123055";
const ACCENT = "#7FB3F5";

// 블로그 목록 카드는 이 SVG(1200×630, AR 1.905)를 aspect-[16/10](AR 1.6) 박스에
// object-cover로 채운다 — 스케일이 카드 높이에 맞춰지면서 좌우 각각 약 8%(≈96px)씩
// 잘려나간다(src/components/blog/BlogPostGrid.tsx 참고). 텍스트는 이 크롭 영역
// 밖(SAFE_X 이상 안쪽)에만 배치해 목록 썸네일에서 잘리지 않도록 한다.
const SAFE_X = 160;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** 공백 기준 그리디 줄바꿈. 한 "단어"가 maxChars보다 길면 강제로 자른다. */
function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    if (word.length > maxChars) {
      let rest = word;
      while (rest.length > maxChars) {
        lines.push(rest.slice(0, maxChars));
        rest = rest.slice(maxChars);
      }
      current = rest;
    } else {
      current = word;
    }
  }
  if (current) lines.push(current);

  if (lines.length <= maxLines) return lines;
  const truncated = lines.slice(0, maxLines);
  const last = truncated[maxLines - 1];
  truncated[maxLines - 1] = last.length > 1 ? `${last.slice(0, -1)}…` : `${last}…`;
  return truncated;
}

const FONT_STACK =
  "'Malgun Gothic','Apple SD Gothic Neo','Noto Sans KR',sans-serif";

function textLinesSvg(
  lines: string[],
  opts: { x: number; y: number; lineHeight: number; fontSize: number; weight: number; fill: string; opacity?: number }
): string {
  const { x, y, lineHeight, fontSize, weight, fill, opacity = 1 } = opts;
  return lines
    .map(
      (line, i) =>
        `<text x="${x}" y="${y + i * lineHeight}" font-family="${FONT_STACK}" font-size="${fontSize}" font-weight="${weight}" fill="${fill}" fill-opacity="${opacity}">${escapeXml(line)}</text>`
    )
    .join("\n  ");
}

function cardShell(bodyContent: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${BRAND_PRIMARY}" />
      <stop offset="100%" stop-color="${BRAND_DARK}" />
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" rx="0" fill="url(#bg)" />
  <rect x="24" y="24" width="${WIDTH - 48}" height="${HEIGHT - 48}" rx="24" fill="none" stroke="${ACCENT}" stroke-opacity="0.25" stroke-width="1.5" />
  ${bodyContent}
  <text x="${SAFE_X}" y="${HEIGHT - 44}" font-family="${FONT_STACK}" font-size="22" font-weight="700" fill="#FFFFFF" fill-opacity="0.55">CoreDXI</text>
</svg>`;
}

export type CoverCardInput = {
  title: string;
  subtitle: string;
  badge: string;
};

/** 게시글 커버 썸네일(1200×630) — coverImageUrl로 사용, OG 이미지에도 자동 재사용됨 */
export function renderCoverCardSvg({ title, subtitle, badge }: CoverCardInput): string {
  const badgeSvg = `<text x="${SAFE_X}" y="110" font-family="${FONT_STACK}" font-size="26" font-weight="700" fill="${ACCENT}">${escapeXml(badge)}</text>`;

  const titleLines = wrapText(title, 12, 3);
  const titleSvg = textLinesSvg(titleLines, {
    x: SAFE_X,
    y: 200,
    lineHeight: 66,
    fontSize: 54,
    weight: 800,
    fill: "#FFFFFF",
  });

  const subtitleY = 200 + titleLines.length * 66 + 40;
  const subtitleLines = wrapText(subtitle, 28, 2);
  const subtitleSvg = textLinesSvg(subtitleLines, {
    x: SAFE_X,
    y: subtitleY,
    lineHeight: 36,
    fontSize: 28,
    weight: 500,
    fill: "#FFFFFF",
    opacity: 0.82,
  });

  const ruleY = subtitleY + subtitleLines.length * 36 + 28;
  const ruleSvg = `<line x1="${SAFE_X}" y1="${ruleY}" x2="${SAFE_X + 120}" y2="${ruleY}" stroke="${ACCENT}" stroke-width="4" />`;

  return cardShell(`${badgeSvg}\n  ${titleSvg}\n  ${subtitleSvg}\n  ${ruleSvg}`);
}

export type SectionCardInput = {
  /** 예: "STEP 02" 또는 "POINT" */
  eyebrow: string;
  /** ### 소제목 원문 */
  title: string;
  /** 섹션 내 핵심 강조 문구(통계·굵은 문구) */
  highlight: string;
};

/** 본문 섹션(###)마다 삽입하는 카드 이미지 — 소제목 + 핵심 강조 문구를 시각화 */
export function renderSectionCardSvg({ eyebrow, title, highlight }: SectionCardInput): string {
  const eyebrowSvg = `<text x="${SAFE_X}" y="120" font-family="${FONT_STACK}" font-size="24" font-weight="700" fill="${ACCENT}" letter-spacing="2">${escapeXml(eyebrow.toUpperCase())}</text>`;

  const titleLines = wrapText(title, 13, 2);
  const titleSvg = textLinesSvg(titleLines, {
    x: SAFE_X,
    y: 210,
    lineHeight: 60,
    fontSize: 46,
    weight: 800,
    fill: "#FFFFFF",
  });

  const highlightY = 210 + titleLines.length * 60 + 46;
  const highlightLines = wrapText(highlight, 24, 3);
  const highlightSvg = textLinesSvg(highlightLines, {
    x: SAFE_X,
    y: highlightY,
    lineHeight: 40,
    fontSize: 30,
    weight: 600,
    fill: "#FFFFFF",
    opacity: 0.85,
  });

  return cardShell(`${eyebrowSvg}\n  ${titleSvg}\n  ${highlightSvg}`);
}
