/**
 * Header.tsx — 사이트 공통 헤더 (내비게이션)
 *
 * Loom.com 스타일의 반응형 헤더입니다.
 * - 데스크탑: 로고(좌) + 메뉴(중) + 버튼(우) 3단 레이아웃
 * - 모바일: 로고(좌) + 햄버거 버튼(우), 클릭 시 전체 메뉴 펼침
 * - 스크롤 시 배경이 반투명 흰색 + 블러 효과로 전환
 *
 * ── 변경 이력 ──────────────────────────────────────────────────────
 * v0.2  2026-05-14  최초 생성
 *       - Loom 스타일 3단 레이아웃 구현 (로고 / 네비 / 버튼)
 *       - NAV_ITEMS 배열로 메뉴 관리 (홍보팀 수정 용이)
 *       - HEADER_BUTTONS 객체로 버튼 텍스트/링크 관리
 *       - isScrolled state: 스크롤 시 backdrop-blur 헤더 전환
 *       - isMenuOpen state: 모바일 햄버거 메뉴 토글
 *       - 브랜드 로고 이미지 + "CoreDXI" 텍스트 (Logo 컴포넌트)
 *       - aria-label, aria-expanded, role="navigation" 접근성 적용
 * ────────────────────────────────────────────────────────────────────
 *
 * [홍보팀 수정 안내]
 * ─────────────────────────────────────────────────────────────────
 * ✏️  메뉴 항목 수정: 아래 NAV_ITEMS 배열의 label(이름)과 href(링크)를 바꾸세요.
 * 🔗  버튼 수정: 아래 HEADER_BUTTONS 객체의 텍스트와 링크를 바꾸세요.
 * ─────────────────────────────────────────────────────────────────
 */

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TrackedCtaLink } from "@/components/analytics/TrackedCtaLink";

/** 로그아웃 후 이동 URL — Vercel 기본 도메인으로 붙는 것을 막고 공식 도메인으로 통일 */
function publicLogoutUrl(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (env) return `${env}/`;
  if (typeof window !== "undefined") {
    const h = window.location.hostname;
    if (h === "localhost" || h === "127.0.0.1") {
      return `${window.location.origin}/`;
    }
  }
  return "https://www.coredxi.com/";
}

/* =====================================================
   타입 정의
   ===================================================== */
interface NavItem {
  label: string;
  href: string;
}

/* =====================================================
   [홍보팀] 콘텐츠 수정 구역 — 여기만 수정하면 됩니다!
   ===================================================== */

/**
 * [홍보팀] 상단 네비게이션 메뉴 항목입니다.
 * - label: 화면에 표시될 메뉴 이름
 * - href: 클릭 시 이동할 페이지 경로
 * 순서를 바꾸면 메뉴 순서도 바뀝니다.
 */
const NAV_ITEMS = [
  { label: "Home",     href: "/" },
  { label: "회사소개",  href: "/about" },
  { label: "솔루션",   href: "/solutions" },
  { label: "성공사례", href: "/cases" },
  { label: "블로그",   href: "/blog" },
  { label: "문의하기", href: "/contact" },
] satisfies NavItem[];

/**
 * [홍보팀] 오른쪽 버튼의 텍스트와 링크입니다.
 * - login: 로그인 페이지로 이동하는 텍스트 버튼
 * - primary: 진한 파란색 배경 버튼 (주요 행동 유도 — 도입 문의)
 */
const HEADER_BUTTONS = {
  /** [홍보팀] 로그인 버튼 텍스트와 이동 링크입니다. */
  login: {
    label: "로그인",
    href: "/login",
  },
  primary: {
    label: "도입 문의",
    href: "/contact",
  },
} as const;

/* =====================================================
   이 아래는 개발 코드입니다. 수정 시 개발팀에 문의하세요.
   ===================================================== */

/**
 * Header 컴포넌트
 * 모든 페이지 상단에 고정되는 공통 헤더입니다.
 */
export function Header() {
  const { data: session, status } = useSession();
  const isLoggedIn = status === "authenticated" && !!session?.user;

  /* 스크롤 여부 감지: 스크롤하면 헤더에 배경/블러 적용 */
  const [isScrolled, setIsScrolled] = useState(false);
  /* 모바일 메뉴 열림/닫힘 상태 */
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 8);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  /* 모바일 메뉴가 열려있을 때 body 스크롤 방지 */
  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isMenuOpen]);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header
      className={[
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        isScrolled
          ? "bg-background/80 backdrop-blur-lg border-b border-border/60"
          : "bg-transparent",
      ].join(" ")}
    >
      {/* 내부 컨테이너: 최대 너비 제한 + 좌우 패딩 */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <nav
          className="flex h-16 items-center justify-between"
          role="navigation"
          aria-label="메인 네비게이션"
        >

          {/* ─── 좌측: 로고 ───────────────────────────────── */}
          <Logo size={34} showWordmark priority />

          {/* ─── 중앙: 데스크탑 네비게이션 (lg 이상에서만 표시) ─── */}
          <ul className="hidden lg:flex items-center gap-1" role="list">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="relative px-4 py-2 text-sm font-medium text-muted-foreground rounded-md transition-all duration-200 hover:text-foreground hover:bg-accent"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          {/* ─── 우측: 버튼 2개 (lg 이상) + 햄버거 (lg 미만) ─── */}
          <div className="flex items-center gap-3">
            <ThemeToggle />

            {/* [홍보팀] 로그인 여부에 따라 오른쪽 버튼 구역이 바뀝니다. 비로그인: 로그인·도입 문의 / 로그인: 프로필·로그아웃·도입 문의 */}
            <div className="hidden lg:flex items-center gap-2">
              {isLoggedIn ? (
                <>
                  <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/80 py-1 pl-1 pr-2 shadow-sm">
                    {session.user?.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={session.user.image}
                        alt=""
                        className="h-8 w-8 rounded-full object-cover"
                        width={32}
                        height={32}
                      />
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {(session.user?.name ?? session.user?.email ?? "?")
                          .slice(0, 1)
                          .toUpperCase()}
                      </span>
                    )}
                    <span className="max-w-[140px] truncate text-sm font-medium text-foreground">
                      {session.user?.name ?? session.user?.email ?? "사용자"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void signOut({ callbackUrl: publicLogoutUrl() })}
                    className="inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-muted-foreground rounded-md transition-all duration-200 hover:text-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    로그아웃
                  </button>
                  <TrackedCtaLink
                    location="header"
                    href={HEADER_BUTTONS.primary.href}
                    className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-primary rounded-md shadow-sm transition-all duration-200 hover:bg-primary/90 hover:shadow-md hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-0"
                  >
                    {HEADER_BUTTONS.primary.label}
                  </TrackedCtaLink>
                </>
              ) : (
                <>
                  <Link
                    href={HEADER_BUTTONS.login.href}
                    className="inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-muted-foreground rounded-md transition-all duration-200 hover:text-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    {HEADER_BUTTONS.login.label}
                  </Link>

                  <TrackedCtaLink
                    location="header"
                    href={HEADER_BUTTONS.primary.href}
                    className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-primary rounded-md shadow-sm transition-all duration-200 hover:bg-primary/90 hover:shadow-md hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-0"
                  >
                    {HEADER_BUTTONS.primary.label}
                  </TrackedCtaLink>
                </>
              )}
            </div>

            {/* 햄버거 버튼 — 모바일 전용 */}
            <button
              type="button"
              className="lg:hidden inline-flex items-center justify-center p-2 rounded-lg text-foreground/70 hover:text-foreground hover:bg-primary/5 transition-colors"
              aria-label={isMenuOpen ? "메뉴 닫기" : "메뉴 열기"}
              aria-expanded={isMenuOpen}
              aria-controls="mobile-menu"
              onClick={() => setIsMenuOpen((prev) => !prev)}
            >
              {isMenuOpen ? (
                /* X 아이콘 (닫기) */
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              ) : (
                /* 햄버거 아이콘 (열기) */
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </nav>
      </div>

      {/* ─── 모바일 메뉴 드롭다운 ──────────────────────────── */}
      <div
        id="mobile-menu"
        className={[
          "lg:hidden overflow-hidden transition-all duration-300 ease-in-out",
          "bg-background/98 backdrop-blur-md border-t border-border/30",
          isMenuOpen ? "max-h-screen opacity-100" : "max-h-0 opacity-0",
        ].join(" ")}
        aria-hidden={!isMenuOpen}
      >
        <div className="mx-auto max-w-7xl px-4 py-4 space-y-1">
          {/* 모바일 네비게이션 링크 */}
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center px-4 py-3 text-base font-medium text-foreground/80 rounded-xl hover:text-foreground hover:bg-primary/5 transition-colors"
              onClick={closeMenu}
            >
              {item.label}
            </Link>
          ))}

          {/* 모바일 버튼 — 로그인 상태에 따라 분기 */}
          <div className="pt-3 pb-2 flex flex-col gap-2 border-t border-border/30 mt-2">
            {isLoggedIn ? (
              <>
                <div className="flex items-center gap-3 px-4 py-2">
                  {session.user?.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={session.user.image}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-full object-cover"
                      width={40}
                      height={40}
                    />
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {(session.user?.name ?? session.user?.email ?? "?")
                        .slice(0, 1)
                        .toUpperCase()}
                    </span>
                  )}
                  <span className="truncate text-base font-medium text-foreground">
                    {session.user?.name ?? session.user?.email}
                  </span>
                </div>
                <button
                  type="button"
                  className="flex items-center justify-center px-4 py-3 text-base font-medium text-foreground/80 rounded-xl hover:bg-muted/50 transition-colors"
                  onClick={() => {
                    closeMenu();
                    void signOut({ callbackUrl: publicLogoutUrl() });
                  }}
                >
                  로그아웃
                </button>
                <TrackedCtaLink
                  location="header"
                  href={HEADER_BUTTONS.primary.href}
                  className="flex items-center justify-center px-4 py-3 text-base font-semibold text-white bg-primary rounded-xl hover:bg-primary/90 transition-colors"
                  onClick={closeMenu}
                >
                  {HEADER_BUTTONS.primary.label}
                </TrackedCtaLink>
              </>
            ) : (
              <>
                <Link
                  href={HEADER_BUTTONS.login.href}
                  className="flex items-center justify-center px-4 py-3 text-base font-medium text-foreground/80 rounded-xl hover:bg-muted/50 transition-colors"
                  onClick={closeMenu}
                >
                  {HEADER_BUTTONS.login.label}
                </Link>
                <TrackedCtaLink
                  location="header"
                  href={HEADER_BUTTONS.primary.href}
                  className="flex items-center justify-center px-4 py-3 text-base font-semibold text-white bg-primary rounded-xl hover:bg-primary/90 transition-colors"
                  onClick={closeMenu}
                >
                  {HEADER_BUTTONS.primary.label}
                </TrackedCtaLink>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
