import type { TypeCode, User } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { avatarUrl, petImageUrl } from "@/lib/assets"
import { cappedStage } from "@/lib/pet"
import { listClaimedDates } from "./attendance"
import { getTodayKey, getToday } from "./reset"
import { computeStageProgress, currentStageOf, isGraduated } from "./stages"
import { getDailyMissionCatalog, getStageMissionCatalog } from "./catalog"
import { MISSIONS_PER_STAGE, TOTAL_STAGES, bandLabel } from "./bands"

export type CompletionMode = "BUTTON" | "PHOTO" | "EVENT"

export type MissionDTO = {
  id: string
  code: string
  title: string
  description: string
  requiresPhoto: boolean
  completionMode: CompletionMode
  completed: boolean
  reward: {
    seeds: number
    starShards: number
    affinity: number
  }
}

export type StageMissionDTO = {
  stage: number
  unlocked: boolean
  completedCount: number
  requiredForNextStage: number
  /** 구간 이름("방 안에서", "한마디 건네기" …). 유형 이름은 절대 넣지 않는다 */
  bandLabel: string
  missions: MissionDTO[]
}

export type DashboardDTO = {
  dailyMissions: MissionDTO[]
  stageMissions: StageMissionDTO[]
  progress: {
    dailyCompleted: number
    dailyTotal: number
    weeklyCompleted: number
    weeklyTotal: number
    streak: number
  }
  attendance: {
    cycleDay: number
    claimedToday: boolean
    attendanceTotal: number
    /** KST 기준 오늘(YYYY-MM-DD). 화면은 브라우저 시간대로 오늘을 정하지 않는다 */
    todayKey: string
    /** todayKey가 속한 달(YYYY-MM). claimedDates가 어느 달인지 알려준다 */
    month: string
    /** 그 달의 실제 출석 완료 날짜. 다른 달은 GET /api/missions/attendance?month=로 읽는다 */
    claimedDates: string[]
  }
  /**
   * 단계 진행 요약. stageMissions는 현재 단계 주변만 담고 있으므로
   * "37 / 100"을 그리려면 이 값이 따로 필요하다
   */
  stages: {
    current: number
    total: number
    graduated: boolean
  }
  // `string`이 아니라 `TypeCode`다. 넓게 두면 화면이 TRIBE를 색인하지 못해
  // typeCode.includes("...")로 종족을 세게 되고, 시드·픽스처에 존재하지 않는
  // 값("INDEPENDENT_LOW_INCOME_A" 같은 것)이 들어가도 컴파일이 통과한다
  userTypeCode: TypeCode | null
  /** 미션 모달의 캐릭터 칸에 쓰는 펫 이미지. 스킨이 없거나 CDN 미설정이면 null(이모지로 떨어진다) */
  petImageUrl: string | null
  /**
   * 상단 마스코트 자리에 쓰는 사이드바용 종족 아바타(PetSkin.avatarKey). 2026-08-26 사용자
   * 요청으로 그 자리의 종족 이모지를 이 그림으로 바꿨다 — petImageUrl(성장 단계 그림)과는
   * 다른 자리다(사이드바·내 계정 모달과 같은 규칙, lib/profile.ts 참고). null이면 이모지로 떨어진다
   */
  avatarUrl: string | null
}

/**
 * 응답에 실을 단계 창(窓). 현재 단계 앞뒤 2단계.
 *
 * 100단계 × 3미션을 다 실으면 응답이 300개 미션이 된다. 화면은 캐러셀로
 * 한 번에 한 단계만 보여주므로 앞뒤 두 칸만 있으면 화살표를 눌러도 끊기지 않고,
 * 끝에 닿으면 다음 요청이 새 창을 가져온다.
 */
const STAGE_WINDOW = 2

function getCompletionMode(mission: { code: string; requiresPhoto: boolean }): CompletionMode {
  if (mission.requiresPhoto) return "PHOTO"
  if (mission.code === "DAILY_COMMUNITY_POST" || mission.code === "DAILY_CHAT") return "EVENT"
  return "BUTTON"
}

/**
 * 미션 화면 전체 DTO 조립.
 * user는 이미 ensureMissionReset()을 거쳤다고 가정.
 */
export async function buildDashboard(user: User): Promise<DashboardDTO> {
  const today = getTodayKey()
  const typeCode = user.typeCode!

  // 주간: 이번 주 월요일 ~ 오늘
  const mondayOfThisWeek = getMondayOfWeek(new Date())
  const mondayKey = mondayOfThisWeek.toLocaleDateString("sv-SE")
  const todayDate = getToday()

  // 한 번에 낸다(2026-08-21 A). 서로 의존하지 않으므로 순차로 기다릴 이유가 없다.
  // RDS가 us-east-1이라 왕복 1회가 177ms다 — 순차로 기다리면 그것만 1초가 넘는다.
  // 완료 기록은 앞 쿼리의 missionId 목록 대신 관계 필터로 같은 집합을 고른다.
  //
  // 2026-08-23: 미션 카탈로그 2개를 여기서 뺐다. 시드로만 바뀌는 불변 데이터인데
  // 그 둘이 이 묶음 페이로드 76.7KB 중 75.3KB였다. 이유와 계측은 ./catalog.ts 주석에.
  const [
    dailyMissionsRaw,
    allStageMissions,
    dailyCompletions,
    allStageCompletions,
    weeklyCount,
    claimedToday,
    claimedDatesThisMonth,
    activeSkin,
  ] = await Promise.all([
      getDailyMissionCatalog(),
      getStageMissionCatalog(typeCode),
      prisma.userMission.findMany({
        where: { userId: user.id, resetKey: today, mission: { scope: "DAILY" } },
        select: { missionId: true },
      }),
      prisma.userMission.findMany({
        where: {
          userId: user.id,
          resetKey: "STAGE",
          mission: { scope: "STAGE", typeCode, order: { lte: MISSIONS_PER_STAGE } },
        },
        select: { missionId: true },
      }),
      prisma.userMission.count({
        where: {
          userId: user.id,
          resetKey: { gte: mondayKey, lte: today },
          mission: { scope: "DAILY" },
        },
      }),
      prisma.attendanceClaim.count({
        where: { userId: user.id, claimDate: todayDate },
      }),
      // 이번 달 출석 날짜. 첫 화면이 추가 요청 없이 캘린더를 그리도록 여기서 같이 읽는다
      listClaimedDates(user.id, today.slice(0, 7)),
      // 펫 이미지 키. getCurrentUser()는 스킨 관계를 붙이지 않으므로 여기서 따로 읽는다 —
      // 라우트를 getCurrentUserWithSkin()으로 바꾸면 사이드바 프로필과 같은 조회가 두 번 난다.
      user.activePetSkinId
        ? prisma.petSkin.findUnique({
            where: { id: user.activePetSkinId },
            select: { imageKeyBase: true, stageCount: true, avatarKey: true },
          })
        : Promise.resolve(null),
    ])

  const dailyCompletedIds = new Set(dailyCompletions.map((c) => c.missionId))

  const dailyMissions: MissionDTO[] = dailyMissionsRaw.map((m) => ({
    id: m.id,
    code: m.code,
    title: m.title,
    description: m.description,
    requiresPhoto: m.requiresPhoto,
    completionMode: getCompletionMode(m),
    completed: dailyCompletedIds.has(m.id),
    reward: {
      seeds: m.rewardSeeds,
      starShards: m.rewardShards,
      affinity: m.rewardAffinity,
    },
  }))

  // 단계 미션. 해금 계산은 위에서 읽은 행을 그대로 쓴다 —
  // getStageProgress()를 호출하면 같은 두 쿼리를 다시 낸다.
  const completedIdSet = new Set(allStageCompletions.map((c) => c.missionId))
  const stageProgress = computeStageProgress(allStageMissions, completedIdSet)
  const currentStage = currentStageOf(stageProgress)

  const windowStart = Math.max(1, currentStage - STAGE_WINDOW)
  const windowEnd = Math.min(TOTAL_STAGES, currentStage + STAGE_WINDOW)

  const stageMissions: StageMissionDTO[] = stageProgress
    .filter((sp) => sp.stage >= windowStart && sp.stage <= windowEnd)
    .map((sp) => {
    const missions = allStageMissions.filter((m) => m.stage === sp.stage)

    const missionDTOs: MissionDTO[] = missions.map((m) => ({
      id: m.id,
      code: m.code,
      title: m.title,
      description: m.description,
      requiresPhoto: m.requiresPhoto,
      completionMode: getCompletionMode(m),
      completed: completedIdSet.has(m.id),
      reward: {
        seeds: m.rewardSeeds,
        starShards: m.rewardShards,
        affinity: m.rewardAffinity,
      },
    }))

    return {
      stage: sp.stage,
      unlocked: sp.unlocked,
      completedCount: sp.completedCount,
      requiredForNextStage: sp.requiredForNextStage,
      bandLabel: bandLabel(sp.stage),
      missions: missionDTOs,
    }
  })

  // 일간·주간 달성률
  const dailyCompleted = dailyCompletedIds.size
  const dailyTotal = dailyMissionsRaw.length

  // 주간 분모는 경과일 × 5 (아직 팀 합의 필요)
  const daysPassed = Math.floor((new Date().getTime() - mondayOfThisWeek.getTime()) / 86400000) + 1
  const weeklyTotal = Math.min(daysPassed * 5, 35)

  // 오늘이 7일 주기의 몇 일차인가. 아직 안 받았으면 "받게 될 날", 받았으면 "받은 날"이다.
  // 옛 식은 언제나 "받은 날"을 줘서 수령 전에는 캘린더가 하루 앞선 칸을 강조했다.
  // 지급 쪽 식(lib/missions/attendance.ts dayIndex)과 같은 규칙이어야 한다
  const cycleDay =
    claimedToday > 0
      ? ((Math.max(1, user.attendanceTotal) - 1) % 7) + 1
      : (user.attendanceTotal % 7) + 1

  // 사이드바(lib/profile.ts:44)와 같은 규칙으로 만든다. 규칙이 갈라지면 두 화면의 펫이 달라진다.
  // 직접 `${CLOUDFRONT_DOMAIN}/...`로 조립하지 않는다 — 그 환경변수에는 스킴이 없어서
  // (2026-08-24 실측) 상대 경로가 나가고 브라우저가 /missions/d….cloudfront.net/…을 찾는다.
  // 스킴 보정은 lib/assets.ts의 petImageUrl() 한 곳에만 둔다
  const petImage = activeSkin
    ? petImageUrl(activeSkin.imageKeyBase, cappedStage(user.level, activeSkin.stageCount))
    : null

  return {
    dailyMissions,
    stageMissions,
    progress: {
      dailyCompleted,
      dailyTotal,
      weeklyCompleted: weeklyCount,
      weeklyTotal,
      streak: user.streakCount,
    },
    attendance: {
      cycleDay,
      claimedToday: claimedToday > 0,
      attendanceTotal: user.attendanceTotal,
      todayKey: today,
      month: today.slice(0, 7),
      claimedDates: claimedDatesThisMonth,
    },
    stages: {
      current: currentStage,
      total: TOTAL_STAGES,
      graduated: isGraduated(stageProgress),
    },
    userTypeCode: user.typeCode,
    petImageUrl: petImage,
    avatarUrl: avatarUrl(activeSkin?.avatarKey),
  }
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}
