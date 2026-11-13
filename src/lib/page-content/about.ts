export type AboutContent = {
  heroBadge: string;
  heroTitleLine1: string;
  heroTitleLine2: string;
  heroSubtitle: string;
  missionLabel: string;
  missionTitleLine1: string;
  missionTitleLine2: string;
  missionParagraph1: string;
  missionParagraph2: string;
  missionFeatures: { title: string; desc: string }[];
  valuesLabel: string;
  valuesTitle: string;
  values: { title: string; desc: string }[];
  stats: { value: string; label: string }[];
  ctaTitle: string;
  ctaDesc: string;
};

export const ABOUT_CONTENT_DEFAULTS: AboutContent = {
  heroBadge: "회사 소개",
  heroTitleLine1: "비즈니스의 중심(Core)을",
  heroTitleLine2: "AI로 깨우다.",
  heroSubtitle:
    "CoreDXI는 복잡한 기업 협업을 AI로 단순화하고, 지속 가능한 디지털 전환을 설계하는 AX 코어 파트너입니다.",
  missionLabel: "우리의 미션",
  missionTitleLine1: "기술이 아닌 비즈니스",
  missionTitleLine2: "문제를 해결합니다",
  missionParagraph1:
    "AI는 도구입니다. CoreDXI는 그 도구를 고객의 비즈니스에 맞게 설계하고, 조직이 실제로 활용할 수 있는 형태로 전달합니다. 기술 도입에 그치지 않고, 측정 가능한 성과로 연결합니다.",
  missionParagraph2:
    "CoreDXI(코어디엑스아이)의 'Core'는 비즈니스의 핵심을 의미합니다. 조직의 본질적인 문제를 파악하고, AI를 통해 그 핵심을 강화하는 것이 우리의 목표입니다.",
  missionFeatures: [
    { title: "목표 중심", desc: "KPI 기반 AI 도입 전략 수립" },
    { title: "빠른 성과", desc: "4~8주 PoC로 가치 검증" },
    { title: "협업 최적화", desc: "팀 생산성 최대 3배 향상" },
    { title: "엔터프라이즈 보안", desc: "컴플라이언스 준수 설계" },
  ],
  valuesLabel: "핵심 가치",
  valuesTitle: "CoreDXI가 일하는 방식",
  values: [
    {
      title: "단순함",
      desc: "복잡한 AI 기술을 누구나 쓸 수 있는 솔루션으로. 복잡성은 우리가 책임지고, 고객에게는 단순한 경험을 전달합니다.",
    },
    {
      title: "견고함",
      desc: "트렌드가 아닌 지속 가능성을 설계합니다. 도입 후 운영까지 책임지는 파트너십이 CoreDXI의 약속입니다.",
    },
    {
      title: "투명함",
      desc: "ROI, 진행 상황, 리스크를 숨기지 않습니다. 데이터 기반의 솔직한 커뮤니케이션으로 신뢰를 만들어 갑니다.",
    },
  ],
  stats: [
    { value: "20년", label: "IT 시스템 구축·운영 현장 경력" },
    { value: "3분", label: "무료 AX 체크로 우선 과제 확인" },
    { value: "4단계", label: "진단 → 로드맵 → 검증 → 정착" },
  ],
  ctaTitle: "CoreDXI와 함께 시작하세요",
  ctaDesc:
    "AI 전환의 첫 걸음, 부담 없이 상담해 보세요. 영업일 기준 1~2일 내에 담당자가 연락드립니다.",
};
