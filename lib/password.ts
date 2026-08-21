import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto"

// 소유자: A. 자체 DB 계정의 비밀번호 해싱. Google 로그인은 Cognito가 처리하므로 여기를 안 탄다.
//
// 새 의존성을 쓰지 않는다(CLAUDE.md). bcrypt·argon2 대신 Node 표준 scrypt를 쓴다.
// 비밀번호를 평문이나 복호화 가능한 형태로 저장하지 않는다. 여기서 만든 문자열만 DB에 들어간다.
//
// 저장 형식: scrypt$<salt-hex>$<hash-hex>
// 앞에 방식 이름을 박아두는 이유는 나중에 파라미터를 올릴 때 옛 해시를 구분해야 하기 때문이다.

const KEY_LENGTH = 64
const SALT_LENGTH = 16

export function hashPassword(plain: string): string {
  const salt = randomBytes(SALT_LENGTH)
  const hash = scryptSync(plain, salt, KEY_LENGTH)
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`
}

/**
 * 맞으면 true. 형식이 깨진 저장값도 false로 돌려준다 — throw하면 호출부가
 * "비밀번호 틀림"과 "데이터 이상"을 구분해 처리해야 하는데, 로그인 화면이 할 수 있는 건 같다.
 */
export function verifyPassword(plain: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split("$")
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false

  const expected = Buffer.from(hashHex, "hex")
  if (expected.length === 0) return false

  const actual = scryptSync(plain, Buffer.from(saltHex, "hex"), expected.length)
  // 길이가 다르면 timingSafeEqual이 throw한다. 먼저 걸러낸다
  if (expected.length !== actual.length) return false
  // 앞에서부터 한 바이트씩 비교하면 걸린 시간으로 해시를 알아낼 수 있다
  return timingSafeEqual(expected, actual)
}
