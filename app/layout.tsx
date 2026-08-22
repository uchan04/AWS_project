import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getSidebarProfile } from "@/lib/profile";
import { Sidebar } from "./components/Sidebar";
import { ChatLauncher } from "./chat/_components/ChatLauncher";

// APP_ORIGIN은 Amplify 환경변수에 있다. 없으면 배포 도메인으로 떨어진다 —
// metadataBase가 없으면 openGraph 이미지·canonical이 상대경로로 나가서
// 카카오톡·슬랙 링크 미리보기가 아예 안 뜬다
const origin = process.env.APP_ORIGIN || "https://main.d2ynoyp44lt46h.amplifyapp.com";

export const metadata: Metadata = {
  metadataBase: new URL(origin),
  title: {
    default: "함께 걷는 하루",
    template: "%s · 함께 걷는 하루",
  },
  description: "오늘 하루의 작은 걸음을 함께 걷습니다. 나에게 맞는 미션과 함께 자라는 펫.",
  applicationName: "함께 걷는 하루",
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "함께 걷는 하루",
    title: "함께 걷는 하루",
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
    title: "함께 걷는 하루",
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
    <html lang="ko" className="h-full antialiased">
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
      </body>
    </html>
  );
}
