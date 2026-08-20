// 소유자: E. 로그아웃 — 세션 쿠키만 지운다.

import { NextResponse } from "next/server"
import { clearSessionCookie } from "@/lib/auth"

export async function POST(request: Request) {
  await clearSessionCookie()
  return NextResponse.redirect(new URL("/login", request.url))
}
