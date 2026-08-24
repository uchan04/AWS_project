import { getCurrentUserWithSkin } from "@/lib/auth"
// 오늘 날짜 기준은 B의 미션 초기화와 같은 함수를 쓴다(Asia/Seoul). 여기서 따로 계산하면
// 자정 전후에 지갑의 "오늘"과 미션 화면의 "오늘"이 다른 날을 가리킨다
import { getToday, getTodayKey } from "@/lib/missions/reset"
import {
  PET_IDLE_LINES,
  cappedStage,
  cosmeticLabel,
  greetingFor,
  idleAccrual,
  lineIndex,
} from "@/lib/pet"
import { prisma } from "@/lib/prisma"
import { calculateReward } from "@/lib/reward"
import { TRIBE } from "@/lib/types"
import PetView, { type PetState } from "./_components/PetView"
import "@/styles/tokens.css"
import "./pet.css"

// 소유자: C. 펫 화면. (SPEC.md 5절)
// DB나 인증이 실패해도 화면을 죽이지 않고 안내를 띄운다.

// 유저별 데이터를 읽으므로 정적 프리렌더 대상이 아니다.
// 이걸 빼면 빌드 시점에 DB 미연결 안내 화면이 정적으로 굳어 DB가 붙은 뒤에도 그대로 나온다.
export const dynamic = "force-dynamic"

const EFFECT_LABEL: Record<string, string> = {
  SEED: "씨앗 획득",
  SHARD: "별조각 획득",
  AFFINITY: "친밀도 획득",
}

export default async function PetPage() {
  let state: PetState

  try {
    const user = await getCurrentUserWithSkin()
    const skin = user.activePetSkin
    const stageCount = skin?.stageCount ?? 4

    // 진단 전이면 typeCode가 없다. 기본 펫이 정해지기 전이므로 곰과 색을 임시로 쓴다.
    const tribe = user.typeCode ? TRIBE[user.typeCode] : TRIBE.FAMILY_LIVING

    const now = new Date()

    // 방치형으로 모인 씨앗을 화면에 미리 보여준다. 지급은 유저가 버튼을 눌렀을 때
    // POST /api/pet/idle 이 한다 — 페이지를 열기만 해도 쓰기가 나가면 안 된다.
    const idle = idleAccrual(user.lastIdleClaimAt, now)
    const idleSeeds = calculateReward(skin, { seeds: idle.seeds }).seeds ?? 0

    // 펫 대사 (2026-08-23). 방문 간격을 보지 않는다 — 사용자 결정으로 날짜 분기를 걷었다
    // (lib/pet.ts "펫 대사" 주석 참고).
    //
    // 인사는 **서버에서** 고른다. 클라이언트에서 Math.random으로 고르면 서버 HTML과 첫 렌더가
    // 어긋나 하이드레이션 경고가 난다. 씨앗 seed는 유저 + 오늘 날짜다 — 같은 사람이 같은 날
    // 새로고침하면 같은 인사가 나오고(문장이 깜빡이지 않는다) 날이 바뀌면 다른 인사가 나온다.
    // 평상시 대사도 같은 seed에서 시작 위치를 잡는다. 순환은 화면이 마운트된 뒤 클라이언트가 한다
    // getTodayKey()는 아래 "오늘 들어온 재화"에서도 부른다. 순수 함수라 두 번 불러도 같은 값이고,
    // 여기서 미리 계산해 두면 계산 순서를 아는 사람만 읽을 수 있는 코드가 된다
    const lineSeed = `${user.id}-${getTodayKey()}`
    const welcome = greetingFor(lineSeed)
    const idleLineStart = lineIndex(lineSeed, PET_IDLE_LINES.length)

    // 착용 중인 치장 (SPEC.md 5절)
    const worn = await prisma.userCosmetic.findMany({
      where: { userId: user.id, equipped: true },
      select: { item: { select: { name: true, slot: true, imageKey: true } } },
    })

    // ── 오늘 들어온 재화 ──────────────────────────────────────────────────────
    //
    // 지갑에 잔액만 있으면 "미션 → 재화 → 펫"이라는 이 앱의 중심 배선(SPEC.md 5절)이
    // 화면에서 끊긴다. 씨앗이 어디서 온 것인지 유저가 알 방법이 없다.
    // 그래서 오늘 들어온 양을 출처와 함께 한 줄로 내려보낸다. 읽기만 하고 증감은 없다.
    const todayKey = getTodayKey()

    // 단계 미션은 resetKey가 "STAGE" 고정이라 날짜로 못 걸러진다 — completedAt으로 잡는다.
    // getToday()를 쓰지 않는 이유: 그 값은 KST 날짜의 **UTC 자정**이라 날짜 전용 컬럼
    // (lastMissionResetAt·affinityTodayDate) 비교용이다. 타임스탬프에 그대로 쓰면 9시간 어긋난다
    const kstDayStart = new Date(`${todayKey}T00:00:00+09:00`)

    const todayDone = await prisma.userMission.findMany({
      where: {
        userId: user.id,
        OR: [
          { resetKey: todayKey }, // 일일 미션
          { resetKey: "STAGE", completedAt: { gte: kstDayStart } }, // 단계 미션
        ],
      },
      select: { mission: { select: { rewardSeeds: true, rewardShards: true } } },
    })

    // 미션 하나하나에 calculateReward를 걸어 더한다. 합계에 한 번 거는 것과 다르다 —
    // 그 함수가 Math.floor로 내림하므로(lib/reward.ts) 지급 시점과 같은 자리에서 잘라야
    // 화면 숫자가 실제 지급액과 맞는다. (스킨 효과가 전부 NONE인 지금은 값이 같지만,
    // 효과가 생기는 순간 합계-곱셈 방식은 실제보다 크게 나온다)
    let todaySeeds = 0
    let todayShards = 0
    for (const row of todayDone) {
      const got = calculateReward(skin, {
        seeds: row.mission.rewardSeeds,
        starShards: row.mission.rewardShards,
      })
      todaySeeds += got.seeds ?? 0
      todayShards += got.starShards ?? 0
    }

    // 친밀도는 미션에서 나오지 않는다(시드의 rewardAffinity가 전부 0). 챗봇·커뮤니티가 출처이고,
    // 일 상한 100이 걸린 실지급 누계가 User.affinityToday에 이미 있으므로 재구성하지 않는다.
    // 날짜가 지난 값은 0으로 본다 — 리셋은 다음 지급 때 일어나므로(completion.ts) 여기서는
    // 읽기만 하고 쓰지 않는다
    const affinityFresh = user.affinityTodayDate !== null && user.affinityTodayDate >= getToday()
    const todayAffinity = affinityFresh ? user.affinityToday : 0

    const evolutionStage = cappedStage(user.level, stageCount)
    const cloudfront = process.env.CLOUDFRONT_DOMAIN
    const imageUrl = cloudfront && skin ? `${cloudfront}/${skin.imageKeyBase}-${evolutionStage}.png` : null

    // 착용한 배경이 방 배경이 된다 (2026-08-21 사용자 확정). 슬롯당 1개라 첫 행이 유일하다.
    // 없으면 null이고 PetRoom이 기본 방 SVG를 그린다.
    // imageKey에 확장자가 이미 붙어 있다(lib/pet.ts BACKGROUNDS: "backgrounds/….png").
    const wornBackground = worn.find((row) => row.item.slot === "BACKGROUND")
    const roomImageUrl =
      cloudfront && wornBackground ? `${cloudfront}/${wornBackground.item.imageKey}` : null

    // 진화 단계 카드가 단계별 그림을 쓴다. 규칙은 imageUrl과 같은 <base>-<단계>.png다
    // (prisma/seed/items.ts가 imageKeyBase를 고정해 뒀다)
    const stageImageUrls = Array.from({ length: stageCount }, (_, i) =>
      cloudfront && skin ? `${cloudfront}/${skin.imageKeyBase}-${i + 1}.png` : null,
    )

    state = {
      level: user.level,
      exp: user.exp,
      evolutionStage,
      seeds: user.seeds,
      // 배고픔 게이지가 있던 자리를 재화 3종이 대신 쓴다 (2026-08-21 사용자 결정).
      // 씨앗은 이미 위에 있고 두 개만 더 필요하다
      starShards: user.starShards,
      affinity: user.affinity,
      // 오늘 들어온 양. 잔액과 달리 화면에서 갱신하지 않는다 — 먹이기는 씨앗을 쓰는 것이고,
      // 방치형 수령은 미션이 아니라서 "오늘 미션으로 +N"이 바뀌지 않는다
      today: { seeds: todaySeeds, starShards: todayShards, affinity: todayAffinity },
      // 누적 출석일. "오늘의 활동" 카드의 네 번째 칸이다 (2026-08-24 사용자 요청).
      // User에 이미 있는 컬럼이라 쿼리가 늘지 않는다 — AttendanceClaim을 세지 않는 이유가
      // 그것이고, 그 표를 세면 같은 수를 두 곳에서 계산하게 된다(출석 지급은 B의
      // 미션 화면이 하고 attendanceTotal이 그 결과다).
      // 연속 출석(user.streakCount)이 아니다 — 이유는 PetView의 todayTiles 주석
      attendanceDays: user.attendanceTotal,
      idleSeeds,
      idleCapped: idle.capped,
      msToNextSeed: idle.msToNextSeed,
      welcome,
      idleLineStart,
      // DB의 name은 코드다(2026-08-22). 화면에 읽히는 값이므로 표시명으로 바꿔 넘긴다 —
      // 지금 쓰이는 곳은 PetView의 sr-only "착용 중: …" 한 줄이고, 스크린리더가
      // "autumn_path"를 읽으면 안 된다
      worn: worn.map((row) => cosmeticLabel(row.item.name)),
      animal: skin?.name ?? tribe.animal,
      skinName: skin?.name ?? tribe.animal,
      typeCode: user.typeCode ?? null,
      stageCount,
      effectLabel:
        skin && skin.effectType !== "NONE" && skin.effectPct > 0
          ? `${EFFECT_LABEL[skin.effectType] ?? "보너스"} +${skin.effectPct}%`
          : null,
      imageUrl,
      stageImageUrls,
      roomImageUrl,
    }
  } catch (error) {
    console.error("[/pet]", error)
    return (
      <main className="pet pet--shop">
        <div className="pet__top">
          <h1 className="pet__title">펫</h1>
        </div>
        <div className="pet-card">
          <h2 className="pet-card__title">펫 정보를 불러오지 못했어요</h2>
          <span className="pet-card__meta">잠시 후 다시 들어와 주세요.</span>
        </div>
      </main>
    )
  }

  return <PetView initial={state} />
}
