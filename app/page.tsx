"use client"

// 소유자: A. 홈. 종족·펫·오늘 미션 진입점.
//
// 유저·펫·미션 데이터는 DATABASE_URL 공유 후에 붙인다. 지금은 진단 결과만 보여준다.
// 진단 전에는 진단 화면으로 보내는 것 하나만 남긴다. 홈에 아무것도 못 하는 카드를 늘리지 않는다.

import Link from "next/link"
import { useEffect, useState } from "react"
import type { TypeCode } from "@prisma/client"
import { classify } from "@/lib/diagnosis/classify"
import { TRIBE, defaultNickname } from "@/lib/types"
import { readDraft } from "./diagnosis/draft"

type Me = { typeCode: TypeCode; nickname: string }

export default function HomePage() {
  const [me, setMe] = useState<Me | null>(null)

  useEffect(() => {
    const draft = readDraft()
    if (!draft) return
    try {
      const { typeCode, adjective } = classify(draft)
      setMe({ typeCode, nickname: defaultNickname(typeCode, adjective) })
    } catch {
      setMe(null)
    }
  }, [])

  if (!me) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 p-6 text-center">
        <h1 className="text-2xl font-bold">함께 걷는 하루</h1>
        <p className="text-sm text-neutral-500">
          몇 가지만 물어볼게요. 답하기 어려운 건 넘어가도 괜찮아요.
        </p>
        <Link
          href="/diagnosis"
          className="rounded-xl bg-neutral-900 px-6 py-4 text-base font-bold text-white dark:bg-white dark:text-neutral-900"
        >
          시작하기
        </Link>
      </main>
    )
  }

  const tribe = TRIBE[me.typeCode]

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-6">
      <p className="text-sm text-neutral-500">{tribe.family}</p>
      <h1 className="text-xl font-bold">{me.nickname}</h1>

      {/* 펫 이미지는 S3 업로드 전이다. 지금은 종족 색 카드로 자리만 잡는다 */}
      <Link
        href="/pet"
        className="flex flex-col items-center gap-1 rounded-2xl px-6 py-12 text-center text-neutral-900"
        style={{ backgroundColor: tribe.colorHex }}
      >
        <span className="text-5xl">{tribe.animal}</span>
        <span className="text-sm opacity-80">키우기</span>
      </Link>

      <Link
        href="/missions"
        className="rounded-2xl border border-neutral-300 px-5 py-5 dark:border-neutral-700"
      >
        <span className="text-base font-bold">오늘의 미션</span>
        <p className="text-sm text-neutral-500">작은 것부터 하나만 해봐요</p>
      </Link>

      <Link
        href="/community"
        className="rounded-2xl border border-neutral-300 px-5 py-5 dark:border-neutral-700"
      >
        <span className="text-base font-bold">커뮤니티</span>
        <p className="text-sm text-neutral-500">한 줄만 남겨도 충분해요</p>
      </Link>

      <Link href="/diagnosis" className="self-center text-sm text-neutral-500 underline">
        다시 진단하기
      </Link>
    </main>
  )
}
