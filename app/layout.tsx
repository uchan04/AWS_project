import type { Metadata, Viewport } from "next";
import { Gowun_Dodum } from "next/font/google";
import "./globals.css";
import { getSidebarProfile } from "@/lib/profile";
import { Sidebar } from "./components/Sidebar";
import { ChatLauncher } from "./chat/_components/ChatLauncher";
import { DeletedNoticeDialog } from "./community/_components/DeletedNoticeDialog";

// 서체는 next/font로 자기 도메인에서 낸다(2026-08-22).
//
// 전에는 app/globals.css와 styles/tokens.css가 각각 fonts.googleapis.com을 @import했다.
// CSS 안의 @import는 최악의 형태다 — 브라우저가 globals.css를 받아 파싱하기 시작한
// 뒤에야 폰트 CSS를 요청하고, 그 CSS가 다시 fonts.gstatic.com을 요청한다.
// 첫 글자가 뜨기까지 왕복 3번이 직렬로 쌓이고, 그 사이 렌더가 막힌다.
// 게다가 두 파일의 weight 목록이 어긋나 있었다(400;500;600;700 vs 300;400;500;700).
//
// next/font는 빌드 시점에 woff2를 받아 /_next/static으로 자체 호스팅한다.
// 외부 도메인 왕복이 사라지고, size-adjust가 들어간 폴백을 같이 만들어 레이아웃 이동도 없다.
// 방문자 IP가 Google로 가지 않는 것도 이 서비스에는 의미가 있다.
//
// 실제 family 이름은 빌드마다 바뀐다(__Gowun_Dodum_xxxx). 그래서 화면 코드는
// 서체 이름을 직접 쓰지 않고 --font-body / --font-display만 쓴다(styles/tokens.css).
//
// 2026-08-23: 본문용 Noto Sans KR 웹폰트를 **뺐다.** 실측하면 `/missions` 콜드
// 로드의 폰트가 380.9KB였고 그중 220.8KB가 이것이었는데, Android의 시스템 한국어
// 서체가 바로 Noto Sans CJK KR이라 기기에 이미 있는 글꼴을 다시 받고 있었다.
// `subsets: ["latin"]`도 한국어 폰트에는 효과가 없었다(한글은 이름 없는
// unicode-range 조각으로 쪼개져 온다). 이유 전체는 app/globals.css의
// --font-korean-system 주석에 있다. **여기에 한국어 웹폰트를 다시 추가하지 말 것.**
//
// 제목용 Gowun Dodum은 남긴다. 시스템에 대체품이 없다.
const gowunDodum = Gowun_Dodum({
  subsets: ["latin"],
  // 굵기가 400 하나뿐인 정적 폰트다(styles/tokens.css:185 참고)
  weight: "400",
  variable: "--font-gowun-dodum",
  display: "swap",
});

// APP_ORIGIN은 Amplify 환경변수에 있다. 없으면 배포 도메인으로 떨어진다 —
// metadataBase가 없으면 openGraph 이미지·canonical이 상대경로로 나가서
// 카카오톡·슬랙 링크 미리보기가 아예 안 뜬다
const origin = process.env.APP_ORIGIN || "https://main.d2ynoyp44lt46h.amplifyapp.com";

export const metadata: Metadata = {
  metadataBase: new URL(origin),
  title: {
    default: "모꼬지",
    template: "%s · 모꼬지",
  },
  description: "고립은둔청년 맞춤형 사회 복귀 서비스. 나에게 맞는 미션과 함께 자라는 펫.",
  applicationName: "모꼬지",
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "모꼬지",
    title: "모꼬지",
    description: "오늘 하루의 작은 걸음을 함께 걷습니다.",
    url: origin,
  },
  // 링크를 받은 사람이 진단 결과나 유형 이름을 보게 되면 안 된다(낙인 위험).
  // 미리보기 문구는 서비스 소개로만 고정한다
  twitter: { card: "summary" },
  // 진단 결과·커뮤니티 글이 검색에 잡히면 안 되는 서비스다
  robots: { index: false, follow: false },
  appleWebApp: {
    capable: true,
    title: "모꼬지",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  // 모바일에서 확대를 막지 않는다. maximumScale=1은 저시력 사용자를 가둔다
  width: "device-width",
  initialScale: 1,
  themeColor: "#f5f0e8",
};

// 프로필을 여기서 한 번 읽어 props로 내려준다(2026-08-21 A 수정, E 통보).
// 레이아웃은 클라이언트 이동 시 재렌더되지 않으므로 탭을 옮겨도 추가 요청이 없다.
// 전에는 Sidebar와 ChatLauncher가 각자 fetch해서 이동마다 HTTP 왕복 3회가 더 나갔다.
// 쿠키를 읽으므로 정적 프리렌더 대상에서 빠진다 — 인증이 필요한 앱이라 어차피 그렇다.
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const profile = await getSidebarProfile();

  return (
    <html
      lang="ko"
      className={`h-full antialiased ${gowunDodum.variable}`}
    >
      <body className="h-full flex">
        {/* 사이드바·하단 탭을 Tab으로 다 지나지 않고 본문으로 건너뛴다 (globals.css) */}
        <a className="skip-to-content" href="#main-content">
          본문으로 건너뛰기
        </a>
        <Sidebar profile={profile} />
        <div
          id="main-content"
          style={{ flex: 1, background: "#F5F0E8", overflowY: "auto" }}
        >
          {children}
        </div>
        <ChatLauncher diagnosed={profile?.diagnosed ?? false} />
        {/* profile 없으면(미인증) 아예 마운트하지 않는다 — GET이 안 나간다 (D 요청) */}
        {profile && <DeletedNoticeDialog />}
      </body>
    </html>
  );
}
