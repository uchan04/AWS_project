import type { Metadata } from "next";
import "./globals.css";
import { getSidebarProfile } from "@/lib/profile";
import { Sidebar } from "./components/Sidebar";
import { ChatLauncher } from "./chat/_components/ChatLauncher";

export const metadata: Metadata = {
  title: "모꼬지",
  description: "고립은둔청년 맞춤형 사회 복귀 서비스",
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
        <Sidebar profile={profile} />
        <div style={{ flex: 1, background: "#F5F0E8", overflowY: "auto" }}>
          {children}
        </div>
        <ChatLauncher diagnosed={profile?.diagnosed ?? false} />
      </body>
    </html>
  );
}
