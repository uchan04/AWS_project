// 인메모리 고정 윈도 카운터. 로그인·가입 무차별 시도를 늦추는 용도다(A, 2026-08-22).
//
// 한계를 먼저 적는다. Amplify SSR은 Lambda라 인스턴스가 여러 개 뜨고, 이 Map은 인스턴스마다
// 따로 있다. 그래서 "전역 N회"가 아니라 "한 인스턴스에서 N회"다. 인스턴스가 3개면 실효 한도는
// 3배가 된다. 그래도 넣는 이유는 흔한 공격이 한 커넥션으로 수백 번 때리는 형태이고, 그건
// 대개 같은 warm 인스턴스로 들어와서 이 카운터에 걸린다.
//
// 제대로 하려면 DB나 Redis에 카운터를 둬야 한다. DB는 로그인 경로에 쓰기 1회를 더 붙이고
// (커넥션 고갈이 이미 차단 27번이다), Redis는 새 인프라라 둘 다 지금 쓰지 않는다.
// ponytail: 인스턴스별 카운터. 전역이 필요해지면 Redis나 User 테이블 카운터로 올린다.

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

/** Map이 무한히 자라지 않게 이 크기를 넘으면 만료된 항목을 쓸어낸다. */
const SWEEP_THRESHOLD = 5000

/**
 * 요청자 식별자. 프록시(CloudFront·Amplify) 뒤라 소켓 주소가 아니라 헤더를 본다.
 * `x-forwarded-for`는 클라이언트가 위조할 수 있지만, 위조하면 자기 버킷만 갈아치우는 것이라
 * 한도를 우회할 수는 있어도 남의 로그인을 막지는 못한다. 이 한계는 위 주석의 결론과 같다.
 */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0]!.trim()
  return request.headers.get("x-real-ip") ?? "unknown"
}

/** 남은 대기 초. 0이면 통과다. 윈도 길이는 기록할 때 정해지므로 여기서는 받지 않는다. */
export function retryAfter(key: string, limit: number): number {
  const bucket = buckets.get(key)
  if (!bucket) return 0
  const now = Date.now()
  if (bucket.resetAt <= now) {
    buckets.delete(key)
    return 0
  }
  if (bucket.count < limit) return 0
  return Math.ceil((bucket.resetAt - now) / 1000)
}

/** 시도 1회 기록. 윈도가 지났으면 새로 시작한다. */
export function recordAttempt(key: string, windowMs: number): void {
  const now = Date.now()
  if (buckets.size > SWEEP_THRESHOLD) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k)
  }
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return
  }
  bucket.count += 1
}

/** 성공했을 때 호출한다. 정상 사용자가 자기 실패 기록에 막히지 않게 한다. */
export function clearAttempts(key: string): void {
  buckets.delete(key)
}

/** 테스트용. 프로덕션 코드에서는 부르지 않는다. */
export function resetAllAttempts(): void {
  buckets.clear()
}
