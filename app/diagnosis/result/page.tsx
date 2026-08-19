"use client"

// 소유자: A. 진단 결과 화면. docs/dev/diagnosis.md 10장.
//
// 화면에 유형명("건강·정서취약형")과 세부유형을 절대 쓰지 않는다. 종족·동물·색만 보여준다.
// 판정을 여기서 하는 것은 완료 API가 붙기 전까지의 임시 조치다(app/diagnosis/draft.ts).

import Link from "next/link"
import { useEffect, useState } from "react"
import type { Adjective, TypeCode } from "@prisma/client"
import { classify } from "@/lib/diagnosis/classify"
import { NICKNAME_MAX, TRIBE, defaultNickname, isValidNickname } from "@/lib/types"
import { readDraft } from "../draft"

type View =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "ok"; typeCode: TypeCode; adjective: Adjective }

export default function DiagnosisResultPage() {
  const [view, setView] = useState<View>({ status: "loading" })
  const [nickname, setNickname] = useState("")

  useEffect(() => {
    const draft = readDraft()
    if (!draft) {
      setView({ status: "empty" })
      return
    }
    try {
      const { typeCode, adjective } = classify(draft)
      setView({ status: "ok", typeCode, adjective })
      setNickname(defaultNickname(typeCode, adjective))
    } catch {
      // 답변이 깨졌으면 다시 진단하는 것이 유일한 복구 경로다
      setView({ status: "empty" })
    }
  }, [])

  if (view.status === "loading") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center p-6">
        <p className="text-sm text-neutral-500">결과를 준비하고 있어요…</p>
      </main>
    )
  }

  if (view.status === "empty") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-base">아직 진단 결과가 없어요.</p>
        <Link href="/diagnosis" className="rounded-xl border border-neutral-300 px-6 py-3 dark:border-neutral-700">
          진단 시작하기
        </Link>
      </main>
    )
  }

  const tribe = TRIBE[view.typeCode]
  const valid = isValidNickname(nickname)

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <p className="text-sm text-neutral-500">당신의 종족이에요</p>

      <div
        className="flex flex-col items-center gap-2 rounded-2xl px-6 py-10 text-center text-neutral-900"
        style={{ backgroundColor: tribe.colorHex }}
      >
        <span className="text-5xl">{tribe.animal}</span>
        <span className="text-lg font-bold">{tribe.family}</span>
        <span className="text-sm opacity-80">{tribe.colorName}</span>
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-sm text-neutral-500">이름은 지금 바꿔도 되고, 나중에 바꿔도 돼요</span>
        <input
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          maxLength={NICKNAME_MAX}
          className="rounded-xl border border-neutral-300 px-4 py-3 text-base dark:border-neutral-700"
        />
        {!valid && <span className="text-sm text-red-500">닉네임은 2~12자로 입력해 주세요</span>}
      </label>

      {/* 닉네임 PATCH·유저 저장은 DATABASE_URL 공유 후에 붙인다 */}
      <Link
        href="/"
        aria-disabled={!valid}
        className={`rounded-xl px-4 py-4 text-center text-base font-bold text-neutral-900 ${
          valid ? "" : "pointer-events-none opacity-40"
        }`}
        style={{ backgroundColor: tribe.colorHex }}
      >
        {/* 닉네임을 문장에 넣지 않는다. 조사(으로/로)가 받침에 따라 갈려서 어색해진다 */}
        이 이름으로 시작하기
      </Link>

      <Link href="/diagnosis" className="self-center text-sm text-neutral-500 underline">
        다시 진단하기
      </Link>
    </main>
  )
}
