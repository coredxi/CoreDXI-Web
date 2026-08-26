import Link from "next/link";
import { ClipboardCheck, Send, Shield, UserPlus, Users } from "lucide-react";

const SETTING_LINKS = [
  {
    title: "관리자 목록",
    description: "등록된 관리자 계정과 권한을 확인·변경합니다.",
    href: "/admin/users",
    icon: Shield,
  },
  {
    title: "사용자 목록",
    description: "일반 회원(고객) 가입 내역을 확인합니다.",
    href: "/admin/customers",
    icon: Users,
  },
  {
    title: "새 관리자 등록",
    description: "새 관리자 계정을 추가합니다.",
    href: "/admin/register",
    icon: UserPlus,
  },
  {
    title: "뉴스레터 구독자",
    description: "블로그 뉴스레터 구독자 수와 목록을 확인합니다.",
    href: "/admin/newsletter",
    icon: Send,
  },
  {
    title: "AX 체크 리드",
    description: "AX 체크 응답 등급·상태를 확인하고 관리합니다.",
    href: "/admin/leads",
    icon: ClipboardCheck,
  },
] as const;

export default function AdminSettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">관리자 설정</h1>
      <p className="mt-1 text-sm text-gray-500">
        계정·권한 관련 메뉴로 이동할 수 있습니다.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SETTING_LINKS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <Icon className="h-8 w-8 text-[#1E4E8C]" aria-hidden />
              <h2 className="mt-4 font-semibold text-gray-900">{item.title}</h2>
              <p className="mt-1 text-sm text-gray-500">{item.description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
