import type { Metadata } from "next";
import "./globals.css";
import { BottomNav } from "./components/BottomNav";

export const metadata: Metadata = {
  title: "함께 걷는 하루",
  description: "고립은둔청년 맞춤형 사회 복귀 서비스",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <div className="flex-1">{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}
