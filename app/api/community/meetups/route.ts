import type { NextRequest } from "next/server"
import { GalleryType, MeetupStatus } from "@prisma/client"
import { getCurrentUser, UnauthorizedError } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ok, fail } from "@/lib/api"

const TITLE_MAX = 80
const PLACE_MAX = 120
const BODY_MAX = 2000

/**
 * 목록·개설 응답의 공통 형태.
 * 참가자 명단은 절대 넣지 않는다 — 오프라인 모임에 누가 오는지는 신청자 본인 외에는 볼 수 없다.
 * joined는 "현재 유저가 취소하지 않은 신청을 갖고 있는가"뿐이라 남의 참여 여부를 노출하지 않는다.
 */
type MeetupItem = {
  id: string
  galleryType: GalleryType
  title: string
  place: string
  startsAt: Date
  minCount: number
  capacity: number
  joinCount: number
  status: MeetupStatus
  host: { nickname: string }
  joined: boolean
}

function isGalleryType(value: string): value is GalleryType {
  return (Object.values(GalleryType) as string[]).includes(value)
}

function isMeetupStatus(value: string): value is MeetupStatus {
  return (Object.values(MeetupStatus) as string[]).includes(value)
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    const params = request.nextUrl.searchParams

    // gallery 없으면 전체 갤러리를 섞어 보여준다. 값이 있으면 enum에 있는 것만 받는다.
    const galleryParam = params.get("gallery")
    if (galleryParam !== null && !isGalleryType(galleryParam)) {
      return fail("INVALID_QUERY", "갤러리를 찾을 수 없어요", 400)
    }

    const statusParam = params.get("status")
    if (statusParam !== null && !isMeetupStatus(statusParam)) {
      return fail("INVALID_QUERY", "모임 상태를 찾을 수 없어요", 400)
    }
    const status: MeetupStatus = statusParam ?? MeetupStatus.OPEN

    const meetups = await prisma.meetup.findMany({
      where: {
        deletedAt: null,
        status,
        // OPEN 목록은 "지금 신청할 수 있는 모임"이다. 이미 시작한 모임은 상태가 OPEN으로 남아 있어도
        // 신청받을 수 없으므로 뺀다. CONFIRMED·CANCELED를 골라 본 경우는 지난 모임도 그대로 보여준다.
        ...(status === MeetupStatus.OPEN ? { startsAt: { gte: new Date() } } : {}),
        ...(galleryParam ? { galleryType: galleryParam } : {}),
      },
      orderBy: { startsAt: "asc" },
      select: {
        id: true,
        galleryType: true,
        title: true,
        place: true,
        startsAt: true,
        minCount: true,
        capacity: true,
        joinCount: true,
        status: true,
        host: { select: { nickname: true } },
        // 본인 행만 골라 가져온다. 명단 전체를 include하면 응답에 남의 userId가 실린다.
        participants: {
          where: { userId: user.id, canceledAt: null },
          select: { id: true },
        },
      },
    })

    const items: MeetupItem[] = meetups.map(({ participants, ...meetup }) => ({
      ...meetup,
      joined: participants.length > 0,
    }))

    return ok({ meetups: items })
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    throw error
  }
}

// 개설은 관리자만 한다(User.isAdmin). 재화를 건드리지 않으므로 getCurrentUser로 충분하다.
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user.isAdmin) return fail("UNAUTHORIZED", "관리자만 모임을 개설할 수 있어요", 401)

    const payload = await request.json().catch(() => null)

    const requestedGallery = typeof payload?.galleryType === "string" ? payload.galleryType : ""
    if (!isGalleryType(requestedGallery)) return fail("INVALID_BODY", "갤러리를 찾을 수 없어요", 400)

    const title = typeof payload?.title === "string" ? payload.title.trim() : ""
    if (!title || title.length > TITLE_MAX) {
      return fail("INVALID_BODY", `제목은 1~${TITLE_MAX}자로 입력해주세요`, 400)
    }

    const place = typeof payload?.place === "string" ? payload.place.trim() : ""
    if (!place || place.length > PLACE_MAX) {
      return fail("INVALID_BODY", `장소는 1~${PLACE_MAX}자로 입력해주세요`, 400)
    }

    const body = typeof payload?.body === "string" ? payload.body.trim() : ""
    if (!body || body.length > BODY_MAX) {
      return fail("INVALID_BODY", `본문은 1~${BODY_MAX}자로 입력해주세요`, 400)
    }

    const capacity = payload?.capacity
    if (!Number.isInteger(capacity) || capacity < 1) {
      return fail("INVALID_BODY", "정원은 1명 이상으로 입력해주세요", 400)
    }

    const minCount = payload?.minCount
    if (!Number.isInteger(minCount) || minCount < 1) {
      return fail("INVALID_BODY", "최소 인원은 1명 이상으로 입력해주세요", 400)
    }
    if (minCount > capacity) {
      return fail("INVALID_BODY", "최소 인원은 정원보다 많을 수 없어요", 400)
    }

    // new Date("아무 문자열")은 throw하지 않고 Invalid Date를 준다. getTime()이 NaN인지로 본다.
    const startsAt = typeof payload?.startsAt === "string" ? new Date(payload.startsAt) : new Date(NaN)
    if (Number.isNaN(startsAt.getTime())) {
      return fail("INVALID_BODY", "모임 일시를 다시 입력해주세요", 400)
    }
    if (startsAt.getTime() <= Date.now()) {
      return fail("INVALID_BODY", "모임 일시는 현재보다 뒤여야 해요", 400)
    }

    // status는 스키마 기본값 OPEN, joinCount는 기본값 0을 그대로 쓴다.
    const created = await prisma.meetup.create({
      data: {
        galleryType: requestedGallery,
        hostId: user.id,
        title,
        body,
        place,
        startsAt,
        minCount,
        capacity,
      },
      select: {
        id: true,
        galleryType: true,
        title: true,
        place: true,
        startsAt: true,
        minCount: true,
        capacity: true,
        joinCount: true,
        status: true,
        host: { select: { nickname: true } },
      },
    })

    // 갓 만든 모임이라 신청자는 아직 없다. 목록과 같은 형태로 돌려준다.
    const meetup: MeetupItem = { ...created, joined: false }

    return ok({ meetup })
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    throw error
  }
}
