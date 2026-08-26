// 소유자: C. **상점 구매 경로 전용** 테스트 계정을 공유 RDS에 만든다.
//   npx tsx scripts/create-shop-test-user.ts
//   npx tsx scripts/seed-demo-currency.ts shop@welli.local   ← 재화는 이쪽이 넣는다
//
// 왜 계정을 하나 더 만드는가: 팀 공용 계정(test@welli.local)은 배경 6종·스킨 4종을 이미
// 보유해서 구매 버튼이 전부 "착용"이다. 구매 경로가 ALREADY_OWNED에서 끊겨 **차감을
// 화면에서 확인할 수 없다.** 보유 행을 지워 조건을 만드는 것은 공유 DB의 실데이터를
// 지우는 일이라, 지우지 않고 조건을 갖춘 계정을 새로 만든다(2026-08-25 사용자 결정).
//
// 이 계정이 갖춘 조건:
//   - 치장 0종 보유       → 배경 6칸 전부 "별조각 500" 구매 버튼
//   - 변종 스킨 미보유    → /pet/skins에서 북극여우 2500 구매도 누를 수 있다
//   - 기본 스킨 보유·활성 → 펫이 뜬다(활성 스킨이 없으면 빈 화면이 된다)
//   - 진단 완료(여우)     → 종족·색·닉네임이 채워진 정상 화면
//   - Lv.26 / 4단         → 4단 진화 이미지와 외출 장소 8곳이 전부 해금된 상태
//   재화는 넣지 않는다 — 확정값의 출처는 scripts/seed-demo-currency.ts 하나다.
//
// 계정 정보를 파일에 적어 둔 것은 5인이 같은 계정으로 화면을 확인해야 하기 때문이다.
// 비밀은 아니고 다른 어디에도 쓰지 않는다. 심사·배포 전에 지운다
// (scripts/create-local-user.ts와 같은 취급이다).
//
// **브라우저에서 이 계정으로 들어가려면 `.env`의 DEV_AUTH_BYPASS를 "false"로 두어야 한다.**
// lib/auth.ts getCurrentUser()가 그 분기를 세션 쿠키보다 먼저 보고, true면 무슨 짓을 해도
// local:team-test 계정이 돌아온다. false로 바꾼 뒤 개발 서버를 다시 띄우고 /login으로 들어간다
// (자체 계정은 passwordHash로 로그인해 Cognito를 타지 않는다. app/api/auth/login/route.ts).
import { PrismaClient } from "@prisma/client"
import { hashPassword } from "../lib/password"
import { defaultNickname } from "../lib/types"

const EMAIL = "shop@welli.local"
const PASSWORD = "welli-test-1234"

// 자체 계정은 cognitoSub에 "local:" 접두사를 쓴다(lib/auth.ts localCognitoSub 주석).
// 매번 같은 행을 쓰도록 고정값이다.
const COGNITO_SUB = "local:shop-test"

// 여우(개과)로 둔 이유: 변종 스킨 중 북극고양이는 S3 이미지가 아직 없어서(prisma/seed/items.ts
// 메모) 구매해도 그림이 안 뜬다. 북극여우는 4단 이미지가 다 올라와 있어 구매 후 결과까지 보인다.
const TYPE_CODE = "HEALTH_EMOTION" as const
// 팀 공용 계정이 "다정한 여우"라 형용사를 달리 준다 — 화면만 보고 어느 계정인지 구분된다.
const ADJECTIVE = "QUIET" as const

// 팀 공용 계정과 같은 지점(Lv.26 exp 350 / 4단)에 둔다. 진화 단계는 저장값이고
// lib/pet.ts cappedStage()가 스킨의 stageCount로 자르기만 한다 — 레벨만 올려도 4단이 되지 않는다.
const LEVEL = 26
const EXP = 350
const EVOLUTION_STAGE = 4

async function main() {
  const prisma = new PrismaClient()
  try {
    const base = {
      email: EMAIL,
      passwordHash: hashPassword(PASSWORD),
      typeCode: TYPE_CODE,
      adjective: ADJECTIVE,
      nickname: defaultNickname(TYPE_CODE, ADJECTIVE),
      level: LEVEL,
      exp: EXP,
      evolutionStage: EVOLUTION_STAGE,
    }

    const user = await prisma.user.upsert({
      where: { cognitoSub: COGNITO_SUB },
      // 재화는 건드리지 않는다. 다시 돌려도 테스트 중이던 잔액이 되돌아가지 않는다
      update: base,
      create: { cognitoSub: COGNITO_SUB, ...base },
    })

    // 기본 스킨(여우)만 보유·활성으로 만든다. 변종은 일부러 주지 않는다 — 구매 대상이다.
    const defaultSkin = await prisma.petSkin.findFirst({
      where: { typeCode: TYPE_CODE, isDefault: true },
      select: { id: true, name: true },
    })
    if (!defaultSkin) throw new Error("기본 스킨이 없다. npm run db:seed를 먼저 돌린다")

    await prisma.userPetSkin.upsert({
      where: { userId_petSkinId: { userId: user.id, petSkinId: defaultSkin.id } },
      update: {},
      create: { userId: user.id, petSkinId: defaultSkin.id },
    })
    if (user.activePetSkinId !== defaultSkin.id) {
      await prisma.user.update({ where: { id: user.id }, data: { activePetSkinId: defaultSkin.id } })
    }

    // 보유 현황을 찍는다. 이 스크립트는 보유 행을 **지우지 않는다** — 한 번 사 본 뒤
    // 다시 0종으로 돌리려면 사람이 판단해서 지운다(시드가 유저 데이터를 지우지 않는 원칙).
    const [skins, cosmetics] = await Promise.all([
      prisma.userPetSkin.count({ where: { userId: user.id } }),
      prisma.userCosmetic.count({ where: { userId: user.id } }),
    ])

    console.log(`계정 준비 완료: ${EMAIL} / ${PASSWORD}`)
    console.log(`  닉네임 ${user.nickname} (${TYPE_CODE}) Lv.${user.level} ${user.evolutionStage}단`)
    console.log(`  활성 스킨 ${defaultSkin.name} · 보유 스킨 ${skins}종 · 보유 치장 ${cosmetics}종`)
    console.log(`  재화 씨앗 ${user.seeds} / 별조각 ${user.starShards} / 친밀도 ${user.affinity}`)
    console.log(`  → 재화는 npx tsx scripts/seed-demo-currency.ts ${EMAIL} 로 넣는다`)
  } finally {
    await prisma.$disconnect()
  }
}

main()
