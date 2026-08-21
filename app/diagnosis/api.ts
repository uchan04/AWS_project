// 소유자: A. 진단 화면들이 쓰는 API 호출부. draft.ts(sessionStorage 임시 통로)를 대신한다.
//
// 판정은 서버가 한다. 화면은 classify()를 부르지 않는다 — 지표 계산이 브라우저에 있으면
// 클라이언트를 고쳐 유형을 바꿀 수 있고, 내부 유형명이 번들에 실린다.

import type { Adjective, TypeCode } from "@prisma/client"
import type { Answer } from "@/lib/diagnosis/indicators"

/** 완료 API와 GET /me가 같은 모양을 돌려준다. subTypeCode와 지표는 들어오지 않는다. */
export type DiagnosisView = {
  typeCode: TypeCode
  adjective: Adjective
  nickname: string
  family: string
  animal: string
  colorHex: string
}

type ApiBody<T> = { data?: T; error?: { code: string; message: string } }

async function read<T>(response: Response): Promise<T> {
  const body: ApiBody<T> = await response.json().catch(() => ({}))
  if (!response.ok || body.error) {
    throw new Error(body.error?.message ?? "잠시 후 다시 시도해 주세요")
  }
  return body.data as T
}

export async function completeDiagnosis(answers: Answer[]): Promise<DiagnosisView> {
  const response = await fetch("/api/diagnosis/complete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ answers }),
  })
  return read<DiagnosisView>(response)
}

/**
 * 미인증과 "로그인했지만 진단 전"을 가른다. 홈의 "시작하기"가 갈 곳이 이 둘에서 다르다 —
 * 미인증은 가입/로그인부터, 로그인 상태면 문항부터다. me만 보면 둘 다 null이라 구분이 안 된다.
 */
export type MeState = { authed: boolean; me: DiagnosisView | null }

export async function fetchMeState(): Promise<MeState> {
  const response = await fetch("/api/diagnosis/me")
  if (response.status === 401) return { authed: false, me: null }
  return { authed: true, me: await read<DiagnosisView | null>(response) }
}

/** 진단 전이면 null. 로그인 전에도 null로 취급해 시작 화면을 보여준다. */
export async function fetchMe(): Promise<DiagnosisView | null> {
  return (await fetchMeState()).me
}

/**
 * 결과 화면의 판정 근거 3줄. 없으면 null이다 —
 * 진단 전, 미인증, Bedrock 실패가 전부 null로 온다(화면은 카드를 빼면 된다).
 */
export async function fetchReason(): Promise<string[] | null> {
  const response = await fetch("/api/diagnosis/reason")
  if (!response.ok) return null
  const body: ApiBody<{ lines: string[] } | null> = await response.json().catch(() => ({}))
  return body.data?.lines ?? null
}

export async function saveNickname(nickname: string): Promise<string> {
  const response = await fetch("/api/diagnosis/nickname", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ nickname }),
  })
  const data = await read<{ nickname: string }>(response)
  return data.nickname
}
