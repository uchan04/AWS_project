import type { Mission, TypeCode } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { MISSIONS_PER_STAGE } from "./bands"

/**
 * 미션 카탈로그 프로세스 내 캐시.
 *
 * 왜 필요한가 — 계측 결과(scripts/perf-*.ts)를 순서대로 적으면:
 *
 *   1. RDS가 us-east-1이라 왕복 1회가 177ms다. 링크 자체는 완벽하다
 *      (SELECT 1 을 40회 냈을 때 40/40 전부 177±4ms).
 *   2. ORM 쿼리 하나는 SQL 정확히 1문이다. N+1도 관계 필터 펼침도 없다.
 *   3. 그런데 같은 문을 처음 내는 연결에서는 왕복 2회가 든다(362ms). Postgres
 *      확장 프로토콜의 prepare 왕복이고, 그 캐시는 **연결마다** 따로다.
 *      순차로 반복하면 같은 연결을 재사용해 2회차부터 180ms로 고정된다.
 *   4. 문제는 병렬이다. buildDashboard는 6개를 Promise.all로 내는데 그 6개가
 *      서로 다른 연결에 흩어진다. 풀 상한이 25면 (문 6개 × 연결 25개 = 준비 150회)를
 *      다 채우기 전까지 매 요청이 미스를 섞어 맞는다. 실측 벽시계가 182ms와 728ms
 *      사이를 계속 오갔다(왕복 1~4회).
 *   5. connection_limit을 낮춰 캐시를 뜨겁게 유지하는 방향은 측정해서 각하했다.
 *      낮추면 그만큼 직렬화된다 — limit=1은 정확히 6×181=1086ms, limit=2는 540ms.
 *      기본값 25가 가장 빨랐다. 즉 DATABASE_URL은 손댈 이유가 없다.
 *
 * 남은 유일한 레버가 **문의 개수**다. 그리고 6개 중 2개는 사용자와 무관하다 —
 * 미션 카탈로그는 시드 스크립트로만 바뀌는 불변 데이터인데, 하필 그 2개가
 * 응답 페이로드 76.7KB 중 75.3KB를 차지한다(STAGE 300행을 본문까지 끌어온다).
 * 요청마다 같은 300행을 다시 읽을 이유가 없다.
 *
 * TTL을 두는 이유 — 시드를 다시 돌렸을 때 서버를 재시작하지 않아도 5분 안에 반영된다.
 * 미션 문구가 5분 늦게 반영되는 것은 문제가 되지 않고, 대신 "서버 재시작 전까지
 * 옛 문구가 박혀 있다"는 함정을 없앤다.
 *
 * 진행 중 요청을 합치는 이유 — 캐시가 비었을 때 동시 요청 N개가 들어오면 같은 쿼리를
 * N번 내게 된다. Promise를 캐시에 넣어 첫 요청 하나만 DB를 치게 한다.
 */
const TTL_MS = 5 * 60_000

type Entry = { at: number; rows: Promise<Mission[]> }

const cache = new Map<string, Entry>()

function cached(key: string, load: () => Promise<Mission[]>): Promise<Mission[]> {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.rows

  const rows = load().catch((e) => {
    // 실패한 Promise를 캐시에 남기면 TTL 동안 모든 요청이 같은 에러를 받는다
    cache.delete(key)
    throw e
  })
  cache.set(key, { at: Date.now(), rows })
  return rows
}

/** 일일 미션 전체. 모든 사용자가 같은 목록을 본다 */
export function getDailyMissionCatalog(): Promise<Mission[]> {
  return cached("DAILY", () =>
    prisma.mission.findMany({ where: { scope: "DAILY" }, orderBy: { order: "asc" } }),
  )
}

/**
 * 유형별 단계 미션 전체(1~100단계).
 *
 * order 상한 이유는 lib/missions/stages.ts getStageProgress 주석에 있다 —
 * 옛 시드가 만든 단계당 4번째 미션 9개가 DB에 남아 있어 여기서 배제한다.
 */
export function getStageMissionCatalog(typeCode: TypeCode): Promise<Mission[]> {
  return cached(`STAGE:${typeCode}`, () =>
    prisma.mission.findMany({
      where: { scope: "STAGE", typeCode, order: { lte: MISSIONS_PER_STAGE } },
      orderBy: [{ stage: "asc" }, { order: "asc" }],
    }),
  )
}

/** 시드를 다시 돌린 직후 등, 캐시를 즉시 버려야 할 때. 스크립트·테스트용 */
export function clearMissionCatalog(): void {
  cache.clear()
}
