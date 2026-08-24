import assert from "node:assert/strict"
import { hashPassword, verifyPassword } from "../lib/password"
import {
  clearAttempts,
  clientKey,
  recordAttempt,
  resetAllAttempts,
  retryAfter,
} from "../lib/ratelimit"
import { createSessionToken, readSessionToken } from "../lib/session"

// npx tsx scripts/check-auth.ts
// 자체 계정 로그인의 비밀번호 해싱과 세션 서명. 둘 중 하나가 조용히 깨지면
// 로그인만 안 되거나 아무 쿠키로나 로그인되므로, 고쳤으면 이걸 돌려본다.
//
// package.json에 npm 스크립트를 추가하려면 E에게 요청해야 한다(CLAUDE.md 1절).

// SESSION_SECRET이 없는 환경에서도 이 체크는 돌아야 한다
process.env.SESSION_SECRET ||= "check-auth-secret"

// --- 비밀번호 ---

const stored = hashPassword("hunter2!!")

// 평문이 저장값에 남지 않는다
assert.equal(stored.includes("hunter2!!"), false)
assert.match(stored, /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/)

assert.equal(verifyPassword("hunter2!!", stored), true)
assert.equal(verifyPassword("hunter2!!x", stored), false)
assert.equal(verifyPassword("", stored), false)

// 같은 비밀번호도 salt가 달라 저장값이 매번 다르다
assert.notEqual(hashPassword("hunter2!!"), stored)

// 깨진 저장값은 throw하지 않고 false
assert.equal(verifyPassword("hunter2!!", ""), false)
assert.equal(verifyPassword("hunter2!!", "scrypt$$"), false)
assert.equal(verifyPassword("hunter2!!", "bcrypt$abc$def"), false)
assert.equal(verifyPassword("hunter2!!", "scrypt$zz$zz"), false)

// --- 세션 ---

const now = 1_700_000_000_000
const token = createSessionToken("clx0user0000", now)

assert.equal(readSessionToken(token, now), "clx0user0000")

// 만료 하루 전은 통과, 8일 뒤는 거부
assert.equal(readSessionToken(token, now + 6 * 86_400_000), "clx0user0000")
assert.equal(readSessionToken(token, now + 8 * 86_400_000), null)

// 서명 없이 만든 토큰은 거부 — 이게 뚫리면 아무 계정으로나 로그인된다
const [userId, expiresAt] = token.split(".")
assert.equal(readSessionToken(`${userId}.${expiresAt}.`, now), null)
assert.equal(readSessionToken(`${userId}.${expiresAt}`, now), null)
assert.equal(readSessionToken(`${userId}.${expiresAt}.AAAA`, now), null)

// 유저 id를 바꿔치기하면 서명이 안 맞는다
assert.equal(readSessionToken(token.replace("clx0user0000", "clx0other000"), now), null)

// 만료를 늘려도 서명이 안 맞는다
assert.equal(readSessionToken(`${userId}.${Number(expiresAt) + 86_400}.${token.split(".")[2]}`, now), null)

// 다른 키로 서명한 토큰은 거부
process.env.SESSION_SECRET = "another-secret"
assert.equal(readSessionToken(token, now), null)
process.env.SESSION_SECRET = "check-auth-secret"

// 형식이 아닌 값
assert.equal(readSessionToken("", now), null)
assert.equal(readSessionToken("a.b.c.d", now), null)
assert.equal(readSessionToken("a.notanumber.c", now), null)

// --- 레이트 리밋 ---

// 한도까지는 통과하고 한도를 넘기면 막힌다
resetAllAttempts()
for (let i = 0; i < 3; i += 1) {
  assert.equal(retryAfter("k", 3), 0)
  recordAttempt("k", 60_000)
}
assert.ok(retryAfter("k", 3) > 0)

// 성공 시 지우면 다시 열린다 — 공용 IP 사용자가 남의 실패에 막히지 않는 근거
clearAttempts("k")
assert.equal(retryAfter("k", 3), 0)

// 키가 다르면 서로 영향이 없다
resetAllAttempts()
for (let i = 0; i < 5; i += 1) recordAttempt("a", 60_000)
assert.ok(retryAfter("a", 3) > 0)
assert.equal(retryAfter("b", 3), 0)

// 윈도가 지나면 풀린다. 시계를 못 돌리므로 윈도를 0으로 줘서 즉시 만료시킨다
resetAllAttempts()
for (let i = 0; i < 5; i += 1) recordAttempt("c", 0)
assert.equal(retryAfter("c", 3), 0)

// x-forwarded-for의 첫 홉만 쓴다(프록시가 뒤에 자기 IP를 붙인다)
assert.equal(
  clientKey(new Request("http://x/", { headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" } })),
  "1.2.3.4"
)
assert.equal(clientKey(new Request("http://x/")), "unknown")

resetAllAttempts()

console.log("auth 체크 통과")
