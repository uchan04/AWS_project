// 소유자: A. 진단 완료. docs/dev/diagnosis.md 10장이 확정 계약이다.
//
// 클라이언트는 { questionCode, choiceCode }만 보낸다. 지표·유형·세부유형은 전부 서버가
// 문항 표(lib/diagnosis/questions.ts)를 보고 계산한다. 클라이언트가 보낸 지표는 믿지 않는다.
//
// 응답에 subTypeCode와 지표를 넣지 않는다. 내부 유형명이 브라우저로 나가면 낙인 위험이 된다.

import { type Prisma } from "@prisma/client"
import { UnauthorizedError, getCurrentUser } from "@/lib/auth"
import { classify } from "@/lib/diagnosis/classify"
import { REDIAGNOSIS_ENABLED } from "@/lib/diagnosis/flags"
import type { Answer } from "@/lib/diagnosis/indicators"
import { fail, ok } from "@/lib/api"
import { prisma } from "@/lib/prisma"
import { TRIBE, defaultNickname } from "@/lib/types"

/** 클라이언트가 보낸 답변 배열의 모양만 검사한다. 값의 의미는 classify()가 판정한다. */
function parseAnswers(value: unknown): Answer[] | null {
  if (!Array.isArray(value) || value.length === 0) return null
  const answers: Answer[] = []
  for (const item of value) {
    if (typeof item !== "object" || item === null) return null
    const { questionCode, choiceCode } = item as Record<string, unknown>
    if (typeof questionCode !== "string" || typeof choiceCode !== "string") return null
    answers.push({ questionCode, choiceCode })
  }
  return answers
}

export async function POST(request: Request) {
  let user
  try {
    user = await getCurrentUser()
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    throw error
  }

  // 재진단 잠금(lib/diagnosis/flags.ts). 링크를 지우는 것만으로는 URL 직접 입력을 막지 못하므로
  // 실제 차단은 여기 한 곳이다.
  if (!REDIAGNOSIS_ENABLED && user.typeCode) {
    return fail("ALREADY_DIAGNOSED", "이미 진단을 마쳤어요", 400)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return fail("INVALID_ANSWER", "진단 답변이 올바르지 않습니다", 400)
  }

  const answers = parseAnswers((body as { answers?: unknown })?.answers)
  if (!answers) return fail("INVALID_ANSWER", "진단 답변이 올바르지 않습니다", 400)

  let result
  try {
    result = classify(answers)
  } catch {
    return fail("INVALID_ANSWER", "진단 답변이 올바르지 않습니다", 400)
  }
  const { typeCode, adjective, subTypeCode, indicators } = result

  // 재진단에서 유저가 직접 고친 닉네임을 덮어쓰지 않는다. 기본값 그대로였을 때만 새로 만든다.
  // 종족이 바뀌면 "조용한 여우"가 곰에게 남아 있게 되므로 그 경우는 갱신해야 한다.
  const untouched =
    !user.nickname ||
    !user.typeCode ||
    !user.adjective ||
    user.nickname === defaultNickname(user.typeCode, user.adjective)
  const nickname = untouched ? defaultNickname(typeCode, adjective) : user.nickname

  // 기본 펫은 시드(prisma/seed/items.ts)가 넣는다. 시드 전이면 null이고, 그때는 펫만 비워 둔다.
  const defaultSkin = await prisma.petSkin.findFirst({
    where: { typeCode, isDefault: true },
    select: { id: true },
  })

  // 활성 펫 스킨은 종족이 바뀔 때만 옮긴다. 무조건 덮어쓰면 재진단할 때마다
  // 별조각 2500으로 산 스킨의 착용이 풀리고 calculateReward()의 배율도 함께 사라진다.
  // (소유 기록 UserPetSkin은 남으므로 데이터 손실은 아니고 착용만 풀렸다)
  // 종족이 바뀌었거나, 아직 활성 스킨이 없을 때(시드보다 먼저 진단한 계정)만 심는다.
  const nextSkinId =
    defaultSkin && (user.typeCode !== typeCode || !user.activePetSkinId) ? defaultSkin.id : null

  // 레벨·경험치·재화·아이템·streak은 건드리지 않는다. 재진단에서 이 코드가 다시 돌기 때문이다.
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        typeCode,
        subTypeCode,
        adjective,
        nickname,
        ...(nextSkinId ? { activePetSkinId: nextSkinId } : {}),
      },
    })

    if (defaultSkin) {
      await tx.userPetSkin.upsert({
        where: { userId_petSkinId: { userId: user.id, petSkinId: defaultSkin.id } },
        update: {},
        create: { userId: user.id, petSkinId: defaultSkin.id },
      })
    }

    // 재진단마다 새 행이 쌓여 이력이 남는다.
    await tx.diagnosisSession.create({
      data: {
        userId: user.id,
        answers: answers as unknown as Prisma.InputJsonValue,
        indicators: indicators as unknown as Prisma.InputJsonValue,
        typeCode,
        subTypeCode,
        adjective,
      },
    })
  })

  const tribe = TRIBE[typeCode]
  return ok({
    typeCode,
    adjective,
    nickname,
    animal: tribe.animal,
    colorHex: tribe.colorHex,
  })
}
