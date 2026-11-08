// [홍보팀] 뉴스레터 관리 화면 공통 틀 — 모든 하위 화면 위에 탭 메뉴를 보여 줍니다.
import type { ReactNode } from "react";
import { NewsletterNav } from "./NewsletterNav";

export default function NewsletterLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <NewsletterNav />
      {children}
    </div>
  );
}
