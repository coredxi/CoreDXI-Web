"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  Building2,
  FileText,
  Home,
  Layers,
  LayoutDashboard,
  Mail,
  Send,
  Settings,
  Shield,
  Users,
} from "lucide-react";

/**
 * [홍보팀] 왼쪽 메뉴(CMS) 항목을 수정하는 곳입니다.
 * - label: 메뉴에 보이는 한글 이름
 * - href: 클릭 시 이동할 주소 (임의 변경 시 개발팀에 문의)
 * - icon: 아이콘 모양 (개발팀 조정 권장)
 */
const ADMIN_CMS_NAV: {
  label: string;
  href: string;
  icon: LucideIcon;
}[] = [
  { label: "대시보드", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "메인 화면 관리", href: "/admin/main", icon: Home },
  { label: "회사 소개 관리", href: "/admin/about", icon: Building2 },
  { label: "솔루션 관리", href: "/admin/solutions", icon: Layers },
  { label: "성공사례 관리", href: "/admin/portfolio", icon: Briefcase },
  { label: "블로그", href: "/admin/blog", icon: FileText },
  { label: "문의 내역 확인", href: "/admin/contact", icon: Mail },
  { label: "뉴스레터 구독자", href: "/admin/newsletter", icon: Send },
  { label: "관리자 설정", href: "/admin/settings", icon: Settings },
];

/**
 * [홍보팀] 하단 「시스템」 메뉴 — 관리자·사용자 계정 관리용
 */
const ADMIN_SYSTEM_NAV: {
  label: string;
  href: string;
  icon: LucideIcon;
}[] = [
  { label: "관리자 목록", href: "/admin/users", icon: Shield },
  { label: "사용자 목록", href: "/admin/customers", icon: Users },
];

function NavLink({
  item,
  pathname,
}: {
  item: { label: string; href: string; icon: LucideIcon };
  pathname: string;
}) {
  const isActive =
    pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
        isActive
          ? "bg-white text-[#1E4E8C] shadow-sm"
          : "text-white/80 hover:bg-white/10 hover:text-white"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {item.label}
    </Link>
  );
}

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <nav aria-label="CMS 메뉴" className="flex h-full flex-col">
      <ul className="space-y-1">
        {ADMIN_CMS_NAV.map((item) => (
          <li key={item.href}>
            <NavLink item={item} pathname={pathname} />
          </li>
        ))}
      </ul>

      <div className="mt-6 border-t border-white/15 pt-4">
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-white/50">
          시스템
        </p>
        <ul className="space-y-1">
          {ADMIN_SYSTEM_NAV.map((item) => (
            <li key={item.href}>
              <NavLink item={item} pathname={pathname} />
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
