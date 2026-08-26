import { PrismaClient } from "@prisma/client"

// 이 기기(121.135.170.5)의 idle 고아 커넥션만 끊는다. 활성 연결·다른 IP·RDS 내부 연결은
// 건드리지 않는다. 데이터는 손대지 않는다 — 놀고 있는 커넥션 슬롯만 반납한다.
const prisma = new PrismaClient()

async function main() {
  const target = process.argv[2]
  if (!target) {
    console.error("usage: tsx terminate-orphan-conns.ts <client_ip>")
    process.exit(1)
  }

  const before = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT count(*) AS count FROM pg_stat_activity
     WHERE host(client_addr) = $1 AND state = 'idle' AND pid <> pg_backend_pid()`,
    target
  )
  console.log(`terminate 대상(idle, ${target}):`, before[0]?.count)

  const result = await prisma.$queryRawUnsafe<{ pid: number; terminated: boolean }[]>(
    `SELECT pid, pg_terminate_backend(pid) AS terminated
     FROM pg_stat_activity
     WHERE host(client_addr) = $1 AND state = 'idle' AND pid <> pg_backend_pid()`,
    target
  )
  const ok = result.filter((r) => r.terminated).length
  console.log(`종료됨: ${ok} / ${result.length}`)
}

main()
  .catch((e) => console.error("terminate error:", e.message))
  .finally(() => prisma.$disconnect())
