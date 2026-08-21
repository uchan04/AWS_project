import type { User } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getTodayKey, getToday } from "./reset"
import { getStageProgress } from "./stages"

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
  }
  userTypeCode: string | null
}

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

  // 일일 미션 5개
  const dailyMissionsRaw = await prisma.mission.findMany({
    where: { scope: "DAILY" },
    orderBy: { order: "asc" },
  })

  const dailyCompletions = await prisma.userMission.findMany({
    where: {
      userId: user.id,
      missionId: { in: dailyMissionsRaw.map((m) => m.id) },
      resetKey: today,
    },
    select: { missionId: true },
  })

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

  // 단계 미션
  const typeCode = user.typeCode!
  const stageProgress = await getStageProgress(user.id, typeCode)

  // 전체 단계 미션 한 번에 조회
  const allStageMissions = await prisma.mission.findMany({
    where: { scope: "STAGE", typeCode },
    orderBy: [{ stage: "asc" }, { order: "asc" }],
  })

  const stageMissionIds = allStageMissions.map((m) => m.id)

  // 전체 단계 완료 기록 한 번에 조회
  const allStageCompletions = await prisma.userMission.findMany({
    where: {
      userId: user.id,
      missionId: { in: stageMissionIds },
      resetKey: "STAGE",
    },
    select: { missionId: true },
  })

  const completedIdSet = new Set(allStageCompletions.map((c) => c.missionId))

  const stageMissions: StageMissionDTO[] = stageProgress.map((sp) => {
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
      missions: missionDTOs,
    }
  })

  // 일간·주간 달성률
  const dailyCompleted = dailyCompletedIds.size
  const dailyTotal = dailyMissionsRaw.length

  // 주간: 이번 주 월요일 ~ 오늘
  const mondayOfThisWeek = getMondayOfWeek(new Date())
  const mondayKey = mondayOfThisWeek.toLocaleDateString("sv-SE")

  const weeklyCount = await prisma.userMission.count({
    where: {
      userId: user.id,
      resetKey: { gte: mondayKey, lte: today },
      mission: { scope: "DAILY" },
    },
  })

  // 주간 분모는 경과일 × 5 (아직 팀 합의 필요)
  const daysPassed = Math.floor((new Date().getTime() - mondayOfThisWeek.getTime()) / 86400000) + 1
  const weeklyTotal = Math.min(daysPassed * 5, 35)

  // 출석
  const todayDate = getToday()
  const claimedToday = await prisma.attendanceClaim.count({
    where: {
      userId: user.id,
      claimDate: todayDate,
    },
  })

  const cycleDay = user.attendanceTotal > 0 ? ((user.attendanceTotal - 1) % 7) + 1 : 1

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
    },
    userTypeCode: user.typeCode,
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
