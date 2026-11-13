export type HomeContent = {
  badge: string;
  title: string;
  subtitle: string;
  primaryCtaText: string;
  primaryCtaHref: string;
  secondaryCtaText: string;
  secondaryCtaHref: string;
  imageSrc: string | null;
  imageAlt: string;
  stats: { value: string; label: string }[];
};

export const HOME_CONTENT_DEFAULTS: HomeContent = {
  badge: "AI 기반 AX 전환 솔루션",
  title: "비즈니스의 중심(Core)을\nAI로 깨우다.",
  subtitle:
    "복잡한 협업은 심플하게, 변화는 단단하게 설계하는\n당신의 AX 코어 파트너, CoreDXI",
  primaryCtaText: "솔루션 도입 문의",
  primaryCtaHref: "/contact",
  secondaryCtaText: "서비스 소개 보기",
  secondaryCtaHref: "/about",
  imageSrc:
    "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=1600&q=80",
  imageAlt: "CoreDXI 서비스 화면 예시",
  stats: [
    { value: "20년", label: "IT 시스템 구축·운영 현장 경력" },
    { value: "3분", label: "무료 AX 체크로 우선 과제 확인" },
    { value: "4단계", label: "진단 → 로드맵 → 검증 → 정착" },
  ],
};
