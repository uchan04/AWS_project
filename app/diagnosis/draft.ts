// 소유자: A. 진단 화면 → 결과 화면으로 답변을 넘기는 임시 통로.
//
// 완료 API가 붙으면 서버가 판정 결과를 돌려주므로 이 파일은 지운다.
// sessionStorage를 쓰는 이유: 답변이 URL에 남으면 뒤로 가기·공유로 유출된다.

import type { Answer } from "@/lib/diagnosis/indicators"

const KEY = "diagnosis:draft"

export function saveDraft(answers: Answer[]) {
  sessionStorage.setItem(KEY, JSON.stringify(answers))
}

export function readDraft(): Answer[] | null {
  const raw = sessionStorage.getItem(KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Answer[]) : null
  } catch {
    return null
  }
}
