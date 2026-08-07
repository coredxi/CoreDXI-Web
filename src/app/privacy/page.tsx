import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = pageMetadata({
  title: "개인정보처리방침",
  description: "CoreDXI 개인정보처리방침입니다.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-background pt-16">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            개인정보처리방침
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            최종 수정일: 2026년 6월 1일 · 시행일: 2026년 6월 1일
          </p>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            CoreDXI(이하 &quot;회사&quot;)는 개인정보보호법 등 관련 법령을 준수하며,
            이용자의 개인정보를 안전하게 보호합니다. 본 방침은 회사가 수집하는
            개인정보의 항목, 수집 목적, 보유 기간 및 처리 방법을 안내합니다.
          </p>

          <div className="mt-10 space-y-10 text-sm leading-relaxed text-foreground/80">
            <section>
              <h2 className="mb-3 text-base font-bold text-foreground">
                제1조 (수집하는 개인정보 항목 및 수집 방법)
              </h2>
              <p className="mb-3">회사는 다음과 같은 개인정보를 수집합니다.</p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-secondary/50">
                      <th className="border border-border px-4 py-2 text-left font-semibold text-foreground">
                        구분
                      </th>
                      <th className="border border-border px-4 py-2 text-left font-semibold text-foreground">
                        수집 항목
                      </th>
                      <th className="border border-border px-4 py-2 text-left font-semibold text-foreground">
                        수집 방법
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-border px-4 py-2">회원가입</td>
                      <td className="border border-border px-4 py-2">
                        이메일 주소, 이름, 비밀번호(암호화 저장)
                      </td>
                      <td className="border border-border px-4 py-2">회원가입 양식</td>
                    </tr>
                    <tr>
                      <td className="border border-border px-4 py-2">소셜 로그인</td>
                      <td className="border border-border px-4 py-2">
                        이메일 주소, 이름, 프로필 이미지(선택)
                      </td>
                      <td className="border border-border px-4 py-2">
                        Google / Kakao / Naver OAuth
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-border px-4 py-2">문의 양식</td>
                      <td className="border border-border px-4 py-2">
                        이름, 이메일 주소, 문의 내용
                      </td>
                      <td className="border border-border px-4 py-2">문의하기 양식</td>
                    </tr>
                    <tr>
                      <td className="border border-border px-4 py-2">뉴스레터 구독</td>
                      <td className="border border-border px-4 py-2">이메일 주소</td>
                      <td className="border border-border px-4 py-2">
                        뉴스레터 구독 양식(페이지 하단)
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-border px-4 py-2">서비스 이용</td>
                      <td className="border border-border px-4 py-2">
                        접속 IP, 쿠키, 서비스 이용 기록(자동 수집)
                      </td>
                      <td className="border border-border px-4 py-2">자동 수집</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-base font-bold text-foreground">
                제2조 (개인정보의 수집 및 이용 목적)
              </h2>
              <ul className="list-disc space-y-2 pl-5">
                <li>회원 가입 및 관리: 본인 확인, 계정 관리, 서비스 이용 계약 이행</li>
                <li>서비스 제공: AI 협업 솔루션, AX 컨설팅 서비스 제공</li>
                <li>고객 문의 응대: 문의 접수 및 답변, 불만 처리</li>
                <li>서비스 개선: 서비스 이용 분석, 오류 개선, 신규 기능 개발</li>
                <li>마케팅 및 광고(별도 동의 시): 서비스 안내, 이벤트 정보 발송</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-base font-bold text-foreground">
                제3조 (개인정보의 보유 및 이용 기간)
              </h2>
              <ol className="list-decimal space-y-2 pl-5">
                <li>
                  회원 탈퇴 시 개인정보는 즉시 삭제됩니다. 단, 관련 법령에 따라
                  보존이 필요한 경우 해당 기간 동안 보관됩니다.
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>계약 또는 청약철회에 관한 기록: 5년 (전자상거래법)</li>
                    <li>소비자 불만 또는 분쟁 처리에 관한 기록: 3년 (전자상거래법)</li>
                    <li>접속 로그 기록: 3개월 (통신비밀보호법)</li>
                  </ul>
                </li>
                <li>
                  문의 양식으로 수집된 정보는 문의 처리 완료 후 2년간 보관됩니다.
                </li>
                <li>
                  뉴스레터 구독을 위해 수집된 이메일 주소는 구독을 해지하는
                  즉시 파기됩니다. 모든 뉴스레터 메일에는 구독 해지 링크가
                  포함되어 있습니다.
                </li>
              </ol>
            </section>

            <section>
              <h2 className="mb-3 text-base font-bold text-foreground">
                제4조 (개인정보의 제3자 제공)
              </h2>
              <p>
                회사는 이용자의 동의 없이 개인정보를 제3자에게 제공하지
                않습니다. 단, 다음의 경우에는 예외로 합니다.
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>이용자가 사전에 동의한 경우</li>
                <li>법령에 의한 경우 또는 수사기관의 합법적 요청이 있는 경우</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-base font-bold text-foreground">
                제5조 (개인정보 처리 위탁)
              </h2>
              <p className="mb-3">
                회사는 서비스 제공을 위해 다음과 같이 개인정보 처리를 위탁합니다.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-secondary/50">
                      <th className="border border-border px-4 py-2 text-left font-semibold text-foreground">
                        수탁 업체
                      </th>
                      <th className="border border-border px-4 py-2 text-left font-semibold text-foreground">
                        위탁 업무
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-border px-4 py-2">Supabase Inc.</td>
                      <td className="border border-border px-4 py-2">데이터베이스 호스팅 및 저장</td>
                    </tr>
                    <tr>
                      <td className="border border-border px-4 py-2">Resend Inc.</td>
                      <td className="border border-border px-4 py-2">이메일 발송 서비스</td>
                    </tr>
                    <tr>
                      <td className="border border-border px-4 py-2">Vercel Inc.</td>
                      <td className="border border-border px-4 py-2">웹 서비스 호스팅</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-base font-bold text-foreground">
                제6조 (정보주체의 권리)
              </h2>
              <p>
                이용자(정보주체)는 다음의 권리를 행사할 수 있습니다.
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>개인정보 열람 요구</li>
                <li>오류 정정 요구</li>
                <li>삭제 요구</li>
                <li>처리 정지 요구</li>
              </ul>
              <p className="mt-3">
                위 권리 행사는 contact@coredxi.com으로 이메일 요청하시거나,
                서비스 내 계정 설정 페이지에서 직접 처리하실 수 있습니다.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-base font-bold text-foreground">
                제7조 (개인정보의 파기)
              </h2>
              <ol className="list-decimal space-y-2 pl-5">
                <li>
                  전자적 파일은 복구 불가능한 방식으로 삭제합니다.
                </li>
                <li>
                  출력물 등 종이에 출력된 개인정보는 분쇄기 등으로 파기합니다.
                </li>
              </ol>
            </section>

            <section>
              <h2 className="mb-3 text-base font-bold text-foreground">
                제8조 (쿠키의 운용)
              </h2>
              <ol className="list-decimal space-y-2 pl-5">
                <li>
                  회사는 로그인 상태 유지, 서비스 이용 분석을 위해 쿠키를
                  사용합니다.
                </li>
                <li>
                  이용자는 브라우저 설정을 통해 쿠키 저장을 거부할 수
                  있습니다. 단, 쿠키 거부 시 로그인 등 일부 서비스 이용이
                  제한될 수 있습니다.
                </li>
              </ol>
            </section>

            <section>
              <h2 className="mb-3 text-base font-bold text-foreground">
                제9조 (개인정보 보호책임자)
              </h2>
              <p className="mb-2">
                회사는 개인정보 처리에 관한 업무를 총괄하기 위해 다음과 같이
                개인정보 보호책임자를 지정합니다.
              </p>
              <ul className="space-y-1 pl-4">
                <li>개인정보 보호책임자: CoreDXI 대표</li>
                <li>이메일: contact@coredxi.com</li>
                <li>웹사이트: www.coredxi.com/contact</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-base font-bold text-foreground">
                제10조 (권익침해 구제 방법)
              </h2>
              <p>
                개인정보 침해에 관한 신고 및 상담은 아래 기관에 문의하실 수
                있습니다.
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>개인정보 침해신고센터: privacy.kisa.or.kr / 118</li>
                <li>개인정보 분쟁조정위원회: www.kopico.go.kr / 1833-6972</li>
                <li>대검찰청 사이버수사과: www.spo.go.kr / 1301</li>
                <li>경찰청 사이버수사국: ecrm.cyber.go.kr / 182</li>
              </ul>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
