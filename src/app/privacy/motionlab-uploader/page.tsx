import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

// [홍보팀] 내부용 YouTube 업로드 도구 "MotionLab Uploader"의 개인정보처리방침입니다.
// Google OAuth 앱 검증 시 이 주소(/privacy/motionlab-uploader)를 제출합니다.
// 회사 전체 방침(/privacy)과는 별개 문서이니 내용을 섞지 마세요.
export const metadata: Metadata = pageMetadata({
  title: "개인정보처리방침 — MotionLab Uploader",
  description:
    "MotionLab Uploader(운영자 본인 YouTube 채널 업로드용 내부 도구)의 개인정보처리방침입니다.",
  path: "/privacy/motionlab-uploader",
});

const CONTACT_EMAIL = "devcoredxi00@coredxi.com";
const URL_USER_DATA_POLICY =
  "https://developers.google.com/terms/api-services-user-data-policy";
const URL_YOUTUBE_TERMS = "https://www.youtube.com/t/terms";
const URL_GOOGLE_PRIVACY = "https://policies.google.com/privacy";
const URL_PERMISSIONS = "https://myaccount.google.com/permissions";

const h2Class = "mb-3 text-base font-bold text-foreground";
const linkClass = "text-primary underline underline-offset-2";

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
      {children}
    </a>
  );
}

function MailLink() {
  return (
    <a href={`mailto:${CONTACT_EMAIL}`} className={linkClass}>
      {CONTACT_EMAIL}
    </a>
  );
}

export default function MotionLabUploaderPrivacyPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-background pt-16">
        <div className="mx-auto max-w-3xl px-6 py-20">
          {/* [홍보팀] 한국어 본문 */}
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            개인정보처리방침 — MotionLab Uploader
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            시행일: 2026년 11월 2일 · 운영: (주)코어디엑스아이 · 문의: <MailLink />
          </p>

          <div className="mt-10 space-y-10 text-sm leading-relaxed text-foreground/80">
            <section>
              <h2 className={h2Class}>1. 앱 소개</h2>
              <p>
                MotionLab Uploader(이하 &quot;앱&quot;)는 운영자가 직접 제작한 영상을 운영자
                본인의 YouTube 채널에 업로드하고 영상 정보(제목, 설명, 썸네일, 재생목록,
                공개 상태)를 관리하기 위한 내부용 도구입니다. 일반 사용자에게 제공되는
                서비스가 아니며, 운영자 본인 계정에서만 사용합니다.
              </p>
            </section>

            <section>
              <h2 className={h2Class}>2. 사용하는 Google 데이터</h2>
              <p>앱은 YouTube Data API를 통해 다음 권한만 요청합니다.</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  <code>youtube.upload</code> — 운영자 채널에 영상 업로드
                </li>
                <li>
                  <code>youtube.force-ssl</code> — 업로드한 영상의 정보·썸네일·재생목록·공개
                  상태 관리
                </li>
              </ul>
              <p className="mt-3">
                앱이 다루는 데이터는 운영자가 업로드하는 영상과 그 메타데이터, 그리고
                Google이 발급하는 인증 토큰뿐입니다. 이름, 연락처, 시청 기록 등 그 밖의
                개인정보는 수집하지 않습니다.
              </p>
            </section>

            <section>
              <h2 className={h2Class}>3. 저장·보관</h2>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  인증 토큰은 운영자의 로컬 컴퓨터에만 저장되며, 외부 서버로 전송하거나 별도
                  서버에 보관하지 않습니다.
                </li>
                <li>업로드 결과(영상 ID 등)는 운영자의 로컬 작업 기록에만 남습니다.</li>
                <li>토큰은 앱 사용을 중단하거나 접근 권한을 취소하면 즉시 삭제합니다.</li>
              </ul>
            </section>

            <section>
              <h2 className={h2Class}>4. 제3자 제공·판매</h2>
              <p>
                앱은 Google 사용자 데이터를 제3자에게 제공·판매·공유하지 않으며, 광고나 분석
                목적으로 사용하지 않습니다. 앱의 Google API 사용자 데이터 이용은{" "}
                <ExternalLink href={URL_USER_DATA_POLICY}>
                  Google API 서비스 사용자 데이터 정책
                </ExternalLink>
                (제한적 사용 요건 포함)을 따릅니다.
              </p>
            </section>

            <section>
              <h2 className={h2Class}>5. YouTube API 서비스</h2>
              <p>
                앱은 YouTube API 서비스를 사용합니다. 앱을 사용하면{" "}
                <ExternalLink href={URL_YOUTUBE_TERMS}>YouTube 서비스 약관</ExternalLink>에
                동의하는 것으로 봅니다. Google의 개인정보 처리는{" "}
                <ExternalLink href={URL_GOOGLE_PRIVACY}>Google 개인정보처리방침</ExternalLink>을
                따릅니다.
              </p>
            </section>

            <section>
              <h2 className={h2Class}>6. 접근 권한 취소</h2>
              <p>
                언제든지{" "}
                <ExternalLink href={URL_PERMISSIONS}>
                  Google 계정 → 보안 → 서드파티 액세스
                </ExternalLink>
                에서 앱의 접근 권한을 취소할 수 있습니다.
              </p>
            </section>

            <section>
              <h2 className={h2Class}>7. 변경 및 문의</h2>
              <p>
                이 방침이 바뀌면 이 페이지에 시행일과 함께 게시합니다. 문의는 <MailLink />
                으로 보내 주십시오.
              </p>
            </section>
          </div>

          {/* [홍보팀] 영어 본문 — Google 검증 심사용 */}
          <hr className="my-16 border-border" />

          <div lang="en">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              Privacy Policy — MotionLab Uploader
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Effective: November 2, 2026 · Operated by CoreDXI Co., Ltd. · Contact:{" "}
              <MailLink />
            </p>

            <div className="mt-10 space-y-10 text-sm leading-relaxed text-foreground/80">
              <section>
                <h3 className={h2Class}>1. About the app</h3>
                <p>
                  MotionLab Uploader (the &quot;App&quot;) is an internal tool used solely by its
                  operator to upload videos the operator produced to the operator&apos;s own
                  YouTube channel and to manage their metadata (title, description, thumbnail,
                  playlist, privacy status). It is not offered to the public.
                </p>
              </section>

              <section>
                <h3 className={h2Class}>2. Google data we use</h3>
                <p>The App requests only the following YouTube Data API scopes:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>
                    <code>youtube.upload</code> — upload videos to the operator&apos;s channel
                  </li>
                  <li>
                    <code>youtube.force-ssl</code> — manage metadata, thumbnails, playlists and
                    privacy status of videos the operator uploaded
                  </li>
                </ul>
                <p className="mt-3">
                  The App handles only the videos and metadata the operator uploads and the
                  OAuth tokens issued by Google. It does not collect names, contact details,
                  watch history or any other personal information.
                </p>
              </section>

              <section>
                <h3 className={h2Class}>3. Storage and retention</h3>
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    OAuth tokens are stored only on the operator&apos;s local computer and are
                    never transmitted to or stored on any other server.
                  </li>
                  <li>
                    Upload results (such as video IDs) are kept only in the operator&apos;s
                    local work logs.
                  </li>
                  <li>Tokens are deleted when the App is no longer used or access is revoked.</li>
                </ul>
              </section>

              <section>
                <h3 className={h2Class}>4. Sharing</h3>
                <p>
                  The App does not sell, transfer or share Google user data with third parties
                  and does not use it for advertising or analytics. The App&apos;s use of
                  information received from Google APIs adheres to the{" "}
                  <ExternalLink href={URL_USER_DATA_POLICY}>
                    Google API Services User Data Policy
                  </ExternalLink>
                  , including the Limited Use requirements.
                </p>
              </section>

              <section>
                <h3 className={h2Class}>5. YouTube API Services</h3>
                <p>
                  The App uses YouTube API Services. By using the App you agree to the{" "}
                  <ExternalLink href={URL_YOUTUBE_TERMS}>YouTube Terms of Service</ExternalLink>.
                  Google&apos;s handling of data is governed by the{" "}
                  <ExternalLink href={URL_GOOGLE_PRIVACY}>Google Privacy Policy</ExternalLink>.
                </p>
              </section>

              <section>
                <h3 className={h2Class}>6. Revoking access</h3>
                <p>
                  You can revoke the App&apos;s access at any time via{" "}
                  <ExternalLink href={URL_PERMISSIONS}>
                    Google Account → Security → Third-party access
                  </ExternalLink>
                  .
                </p>
              </section>

              <section>
                <h3 className={h2Class}>7. Changes and contact</h3>
                <p>
                  Any changes to this policy will be posted on this page with a new effective
                  date. Questions: <MailLink />.
                </p>
              </section>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
