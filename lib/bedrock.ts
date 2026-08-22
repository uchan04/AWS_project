import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime"

// Bedrock 클라이언트를 만드는 유일한 곳.
//
// 왜 모았나(2026-08-23): 클라이언트를 만드는 곳이 4개였고 셋은 `BEDROCK_REGION || "us-east-1"`,
// 하나는 `BEDROCK_REGION || AWS_REGION || "us-east-1"`이라 리전 결정이 파일마다 달랐다.
// 그리고 **네 곳 전부 타임아웃이 없었다.** AWS SDK 기본값은 요청 타임아웃 없음 +
// maxAttempts 3이다. Bedrock이 응답을 안 주고 붙잡고 있으면 상한이 없고,
// 그 상태로 3번 재시도한다 — 최악의 경우 사용자는 무한정 기다린다.
//
// 실측(2026-08-22, 로컬. 자격증명 해석 실패 → SDK 재시도까지 포함):
//   GET /api/community/topics  2.2 ~ 2.4초, 3회 일관
// 성공 경로가 아니라 실패 경로의 시간이다. 상한이 없으면 이 값이 얼마까지 늘어날지 모른다.
//
// 타임아웃은 호출부가 정한다 — 스트리밍과 단발 호출의 성격이 다르다.
// requestTimeout은 "무응답 상태로 허용하는 시간"이다(소켓 유휴 기준). 스트리밍은 토큰이
// 계속 흘러 유휴가 짧게 유지되므로 넉넉히 잡아도 정상 응답을 끊지 않는다.
//
// requestHandler에 객체를 그대로 넘긴다. @smithy/node-http-handler를 직접 import하지 않는다 —
// 그건 SDK의 전이 의존성이고, 직접 import하면 SDK가 올라갈 때 조용히 깨진다.

/** 단발 호출(근거 3줄·주제 추천·사진 판정)의 무응답 상한 */
export const ONESHOT_TIMEOUT_MS = 20_000
/** 스트리밍 채팅의 청크 사이 무응답 상한 */
export const STREAM_TIMEOUT_MS = 60_000

/**
 * @param requestTimeout 무응답 상한(ms). 위 상수 중 하나를 쓴다
 * @param maxAttempts 총 시도 횟수. 기본 2 — SDK 기본값 3은 최악의 대기가 3배가 된다
 */
export function bedrockClient(requestTimeout: number, maxAttempts = 2) {
  return new BedrockRuntimeClient({
    region: process.env.BEDROCK_REGION || process.env.AWS_REGION || "us-east-1",
    maxAttempts,
    requestHandler: { requestTimeout },
  })
}
