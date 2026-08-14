import { NextResponse } from "next/server"

// 응답 형식은 CLAUDE.md 7절에 고정되어 있다. 직접 NextResponse.json을 쓰지 말고 이 두 함수를 쓴다.

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status })
}

/** message는 화면에 그대로 띄울 한국어 문장으로 쓴다. */
export function fail(code: string, message: string, status = 400) {
  return NextResponse.json({ error: { code, message } }, { status })
}
