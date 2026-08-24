#!/usr/bin/env bash
# 정상 상태 TTFB를 경로별로 잰다. 변경 전후 비교의 최종 지표다.
#
#   bash scripts/perf-ttfb.sh [포트] [표본수]
#
# 왜 이 스크립트가 최종 지표인가 — perf-*.ts는 DB 왕복만 잰다. 사용자가 겪는 것은
# HTTP 응답 첫 바이트까지의 시간이고, 여기에는 서버 렌더링과 미들웨어가 포함된다.
# 그래서 개선을 주장하기 전에 이 수치를 전후로 비교한다.
#
# 왜 로그인하는가 — 비인증 상태의 /missions는 리다이렉트라 DB를 치지 않는다.
# 그걸 재면 2ms가 나오고 아무 의미가 없다(첫 시도에서 실제로 그렇게 됐다).
#
# 왜 워밍업을 버리는가 — Prisma는 처음 보는 SQL 문마다 prepare 왕복을 한 번 더 쓴다
# (scripts/perf-prepare.ts에서 1회차 362ms → 이후 180ms 확인). 콜드 표본을 섞으면
# 정상 상태를 못 본다. 콜드 스타트는 scripts/perf-coldstart.sh가 따로 잰다.
#
# 배포하지 않는다. 로컬 next start만 쓴다.

set -u

PORT=${1:-3101}
N=${2:-10}
JAR=/tmp/perf-ttfb-cookie.txt
BASE="http://localhost:${PORT}"

PATHS=(
  "/"
  "/missions"
  "/pet"
  "/community"
  "/settings"
  "/api/missions"
  "/api/pet"
  "/api/community/posts"
)

rm -f "$JAR"
curl -s -c "$JAR" -X POST "${BASE}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@welli.local","password":"welli-test-1234"}' -o /dev/null || {
  echo "로그인 실패 — 서버가 ${BASE}에 떠 있는지, test@welli.local 계정이 있는지 확인"
  exit 1
}

echo
echo "정상 상태 TTFB · 포트 ${PORT} · 경로당 ${N}표본 (앞 3개는 워밍업으로 버린다)"
echo
printf "%-24s %7s %7s %7s %7s\n" "경로" "min" "p50" "p90" "max"
printf '%s\n' "────────────────────────────────────────────────────────────"

for p in "${PATHS[@]}"; do
  # 워밍업 — Prisma prepare 왕복과 Next 라우트 첫 컴파일을 측정에서 뺀다
  for _ in 1 2 3; do
    curl -s -b "$JAR" -o /dev/null "${BASE}${p}" >/dev/null 2>&1
  done

  SAMPLES=""
  for _ in $(seq "$N"); do
    T=$(curl -s -b "$JAR" -o /dev/null -w "%{time_starttransfer}" "${BASE}${p}")
    SAMPLES="${SAMPLES} ${T}"
  done

  # 통계는 awk로 낸다. bc는 Git Bash에 없어 조용히 0을 만든다(실제로 당했다)
  echo "$SAMPLES" | tr ' ' '\n' | grep -v '^$' | sort -n | awk -v p="$p" -v n="$N" '
    { v[NR] = $1 * 1000 }
    END {
      if (NR == 0) { printf "%-24s   (표본 없음)\n", p; exit }
      i50 = int(NR * 0.5); if (i50 < 1) i50 = 1
      i90 = int(NR * 0.9); if (i90 < 1) i90 = 1
      printf "%-24s %6.0fms %6.0fms %6.0fms %6.0fms\n", p, v[1], v[i50], v[i90], v[NR]
    }'
done

echo
echo "왕복 1회 ≈ 180ms (RDS us-east-1). 왕복 환산은 위 값 / 180."
