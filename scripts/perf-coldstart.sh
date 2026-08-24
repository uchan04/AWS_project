#!/usr/bin/env bash
# 콜드 스타트 첫 요청 비용을 잰다. instrumentation.ts 예열의 전후 비교용.
#
#   bash scripts/perf-coldstart.sh [반복횟수] [포트]
#
# 왜 필요한가 — Prisma 연결 풀은 지연 생성이다. 부팅 직후 첫 요청이 TLS 핸드셰이크를
# 여러 번 내면서 정상 상태보다 훨씬 오래 걸린다(scripts/perf-pool.ts에서 병렬 1회차
# 1651ms vs 2회차 181ms로 확인). 서버를 매번 새로 띄워야 재현되므로 스크립트로 둔다.
#
# 배포하지 않는다. 로컬 `next start`만 쓴다.
# 로그인 쿠키가 있어야 DB를 실제로 치는 경로를 잴 수 있다 — 없으면 만든다.

set -u

RUNS=${1:-3}
PORT=${2:-3111}
JAR=/tmp/perf-cold-cookie.txt
PATHS=("/missions" "/pet")

echo "콜드 스타트 측정: ${RUNS}회, 포트 ${PORT}"
echo

for run in $(seq "$RUNS"); do
  npx next start -p "$PORT" >/tmp/perf-cold-server.log 2>&1 &
  SERVER_PID=$!

  # 준비될 때까지 기다린다. 여기서 재는 것은 "준비된 뒤 첫 요청"이므로
  # 준비 대기 시간 자체는 측정에서 빠진다(정적 경로로 확인한다 — DB를 치지 않는다)
  for _ in $(seq 100); do
    if curl -s -o /dev/null --max-time 2 "http://localhost:${PORT}/manifest.webmanifest" 2>/dev/null; then
      break
    fi
    sleep 0.3
  done

  # 로그인. 이 요청도 DB를 치므로 첫 요청 측정에서 분리해 따로 찍는다
  LOGIN=$(curl -s -c "$JAR" -X POST "http://localhost:${PORT}/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@welli.local","password":"welli-test-1234"}' \
    -o /dev/null -w "%{time_starttransfer}")

  LINE="run ${run}:  login $(awk -v t="$LOGIN" 'BEGIN{printf "%5.0fms", t*1000}')"

  for p in "${PATHS[@]}"; do
    FIRST=$(curl -s -b "$JAR" -o /dev/null -w "%{time_starttransfer}" "http://localhost:${PORT}${p}")
    SECOND=$(curl -s -b "$JAR" -o /dev/null -w "%{time_starttransfer}" "http://localhost:${PORT}${p}")
    LINE="${LINE}   ${p} 1차 $(awk -v t="$FIRST" 'BEGIN{printf "%5.0fms", t*1000}') 2차 $(awk -v t="$SECOND" 'BEGIN{printf "%5.0fms", t*1000}')"
  done

  echo "$LINE"

  kill "$SERVER_PID" 2>/dev/null
  wait "$SERVER_PID" 2>/dev/null
  sleep 1
done

echo
echo "1차와 2차의 차이가 예열 비용이다. 예열이 들어가면 1차가 2차에 붙어야 한다."
