export type SolutionsContent = {
  heroBadge: string;
  heroTitleLine1: string;
  heroTitleLine2: string;
  heroSubtitle: string;
  solutionsLabel: string;
  solutionsTitle: string;
  solutions: {
    badge: string;
    title: string;
    desc: string;
    features: string[];
  }[];
  processLabel: string;
  processTitle: string;
  processDesc: string;
  processSteps: { title: string; desc: string }[];
  ctaTitle: string;
  ctaDesc: string;
  /** [홍보팀] AX 컨설팅 카드 소개서 다운로드 버튼 문구. 비워두면 버튼이 숨겨진다. */
  brochureLabel: string;
  /** [홍보팀] 소개서 PDF 경로("/"로 시작하는 상대 경로) 또는 절대 URL. 비워두면 버튼이 숨겨진다. */
  brochureUrl: string;
};

export const SOLUTIONS_CONTENT_DEFAULTS: SolutionsContent = {
  heroBadge: "AI 기반 AX 전환 솔루션",
  heroTitleLine1: "복잡한 협업은 심플하게,",
  heroTitleLine2: "변화는 단단하게.",
  heroSubtitle:
    "CoreDXI의 AX 솔루션은 기업의 실제 문제에서 출발합니다. AI 기술을 조직에 맞게 설계하고, 측정 가능한 성과로 연결합니다.",
  solutionsLabel: "3가지 핵심 솔루션",
  solutionsTitle: "비즈니스 목표에 맞는 솔루션을 선택하세요",
  solutions: [
    {
      badge: "AI 협업",
      title: "AI 협업 자동화",
      desc: "반복적인 회의, 보고, 업무 배분을 AI가 자동화합니다. 복잡한 협업 워크플로우를 단순화하여 팀의 핵심 업무에 집중할 수 있도록 지원합니다.",
      features: [
        "회의록 자동 생성 및 액션 아이템 추출",
        "업무 우선순위 AI 추천",
        "슬랙·Teams·이메일 통합 허브",
        "실시간 진행 현황 대시보드",
      ],
    },
    {
      badge: "AX 컨설팅",
      title: "AX 전환 컨설팅",
      desc: "조직의 현황을 진단하고 AI 전환 로드맵을 수립합니다. PoC부터 전사 확산까지, 단계별로 리스크를 관리하며 성과를 만들어 냅니다.",
      features: [
        "AI 성숙도 진단 및 갭 분석",
        "4~8주 PoC 설계 및 운영",
        "ROI 기반 투자 우선순위 결정",
        "변화 관리 및 조직 내재화 지원",
      ],
    },
    {
      badge: "엔터프라이즈",
      title: "엔터프라이즈 AI 플랫폼",
      desc: "기업 맞춤형 AI 인프라를 설계하고 구축합니다. 보안·컴플라이언스 요건을 충족하면서도, 높은 확장성과 안정성을 제공하는 플랫폼을 제공합니다.",
      features: [
        "온프레미스 및 프라이빗 클라우드 지원",
        "데이터 보안 및 접근 권한 관리",
        "기존 ERP·CRM 시스템 연동",
        "24/7 모니터링 및 SLA 보장",
      ],
    },
  ],
  processLabel: "도입 프로세스",
  processTitle: "4단계로 완성되는 AI 전환",
  processDesc:
    "처음부터 전사 배포까지, CoreDXI가 각 단계를 함께 설계하고 실행합니다.",
  processSteps: [
    { title: "현황 진단", desc: "조직의 AI 성숙도와 핵심 문제를 파악합니다." },
    { title: "로드맵 수립", desc: "ROI 기반의 실행 가능한 전환 계획을 수립합니다." },
    { title: "PoC 검증", desc: "4~8주 내 실제 환경에서 가치를 검증합니다." },
    { title: "전사 확산", desc: "검증된 솔루션을 전 조직으로 확장합니다." },
  ],
  ctaTitle: "지금 바로 무료 상담을 신청하세요",
  ctaDesc:
    "영업일 기준 1~2일 내 전문 컨설턴트가 연락드립니다. AI 전환의 첫 걸음, CoreDXI와 함께 시작하세요.",
  brochureLabel: "소개서 PDF 다운로드",
  brochureUrl: "/docs/coredxi-ax-consulting-brochure.pdf",
};
