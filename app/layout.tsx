import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "./components/Sidebar";

export const metadata: Metadata = {
  title: "함께 걷는 하루",
  description: "고립은둔청년 맞춤형 사회 복귀 서비스",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="h-full flex">
        <Sidebar />
        <main style={{ flex: 1, background: "#F5F0E8", overflowY: "auto" }}>
          {children}
        </main>
      </body>
    </html>
  );
}
