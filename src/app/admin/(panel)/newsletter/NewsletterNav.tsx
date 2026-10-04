/**
 * NewsletterNav.tsx — 뉴스레터 관리 화면 상단 탭(구독자 / 캠페인 / 발송 이력)
 * [홍보팀] 탭 이름을 바꾸려면 TABS의 label만 수정하세요. href는 개발팀 문의.
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "구독자", href: "/admin/newsletter", exact: true },
  { label: "캠페인", href: "/admin/newsletter/campaigns", exact: false },
  { label: "발송 이력", href: "/admin/newsletter/history", exact: false },
] as const;

export function NewsletterNav() {
  const pathname = usePathname();
  return (
    <nav className="mb-6 flex gap-2 border-b border-gray-200" aria-label="뉴스레터 메뉴">
      {TABS.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px rounded-t-xl border-b-2 px-4 py-2 text-sm font-medium ${
              active ? "border-[#1E4E8C] text-[#1E4E8C]" : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
