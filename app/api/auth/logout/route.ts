// 소유자: E. 로그아웃 — 세션 쿠키만 지운다.

import { clearSessionCookie } from "@/lib/auth"
import { appRedirect } from "@/lib/oauth"

export async function POST() {
  await clearSessionCookie()
  // request.url로 절대 URL을 만들면 배포 환경에서 localhost:3000으로 튄다. appRedirect 주석 참고
  return appRedirect("/login")
}
