import { S3Client, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"
import { ApplyGuardrailCommand, type ApplyGuardrailCommandOutput } from "@aws-sdk/client-bedrock-runtime"
import type { GuardrailImageFormat } from "@aws-sdk/client-bedrock-runtime"
import { bedrockClient } from "@/lib/bedrock"

/**
 * 커뮤니티 글 사진의 Bedrock Guardrails 판정.
 *
 * ─── **실패하면 막는다(fail-closed). 텍스트 검열과 반대다.** ───────────────────
 *
 * `_lib/moderation.ts`의 `moderate()`는 Bedrock이 죽어도 글을 통과시킨다(fail-open).
 * 그래도 되는 이유는 **뒤에 백스톱이 있기 때문이다** — `lib/safety.ts`의
 * `containsAbuse()` 정규식과 사전 계층이 모델 없이도 돌고, 모델은 그 위에 얹는 층이다.
 * 거기서는 판정 실패의 대가가 "한 겹이 빠진다"이다.
 *
 * **이미지에는 그 백스톱이 없다.** 정규식으로 사진을 볼 수 없고, 앞단의 어떤 검사도
 * 그림 내용을 보지 않는다. 여기서 열어두면 **판정 실패가 곧 노출이다** — 버킷이
 * CloudFront로 `/*` 공개라(`lib/uploads.ts` 머리 주석) 글에 걸리는 순간 누구나 본다.
 *
 * 그래서 이 파일은 확인하지 못한 것을 통과시키지 않는다. 환경변수가 비어도, S3가
 * 안 읽혀도, Guardrails가 타임아웃이어도 던진다. 사용자에게는 "잠시 후 다시" 문구가
 * 나가고 글은 올라가지 않는다.
 *
 * **이 판단을 "일관성"을 이유로 fail-open으로 바꾸지 마라.** 두 경로가 다른 것은
 * 실수가 아니라 백스톱 유무의 차이다. 바꾸려면 이미지 쪽에 모델 없이 도는 검사를
 * 먼저 만들어야 한다.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * 무응답 상한 10초 · 시도 1회.
 *
 * **텍스트 검열의 3초(`_lib/bedrock.ts`)를 쓰지 않는다.** 그쪽은 문장 몇 줄을 보내는
 * 경로라 3초면 넉넉하고, 넘기면 삼키고 통과시키므로 짧을수록 좋다.
 *
 * 여기는 **최대 4MB를 S3에서 읽어 그대로 Bedrock에 실어 보내는** 경로다. 전송만으로
 * 3초를 넘길 수 있고, 넘기면 fail-closed라 **정상 사진이 거절된다.** 상한이 짧은 것이
 * 곧 오거부이므로 넉넉히 잡는다.
 *
 * 재시도는 1회다. 이미 10초를 기다린 뒤라 2회면 최악의 대기가 20초를 넘어 "올리기"를
 * 누른 사람이 그동안 아무것도 못 한다.
 */
const IMAGE_MODERATION_TIMEOUT_MS = 10_000
const IMAGE_MODERATION_MAX_ATTEMPTS = 1

const bedrock = bedrockClient(IMAGE_MODERATION_TIMEOUT_MS, IMAGE_MODERATION_MAX_ATTEMPTS)

/**
 * `lib/uploads.ts`의 s3 클라이언트는 export되지 않아 여기 새로 만든다.
 * region 결정 규칙은 그 파일과 **같은 값**이어야 한다 — 다르면 한쪽만 고쳐졌을 때
 * 발급은 되는데 읽기가 안 되는 형태로 어긋난다.
 */
const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
})

/**
 * ContentType → Guardrails 이미지 포맷. **삼항이 아니라 map이다.**
 * `lib/uploads.ts`의 `COMMUNITY_EXT` 주석이 이유를 적어 뒀다 — 삼항이면 타입을 하나
 * 늘렸을 때 새 타입이 조용히 잘못된 값으로 흘러간다.
 *
 * Guardrails가 판정하는 이미지 포맷은 PNG·JPEG 둘뿐이다(`GuardrailImageFormat`).
 * 여기 없는 ContentType은 판정할 수 없으므로 통과가 아니라 차단이다.
 */
const GUARDRAIL_FORMAT: Record<string, GuardrailImageFormat> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
}

/** 판정에 실을 수 있는 최대 크기. presign이 발급 시점에 이미 한 번 걸렀지만 여기서 다시 본다. */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024

/** 차단인지 확인 실패인지. 호출부가 서로 다른 문구를 띄워야 해서 갈라 둔다. */
export type ImageModerationKind = "BLOCKED" | "CHECK_FAILED"

/**
 * `detail`은 **로그 전용**이다. 어떤 필터에 걸렸는지 사용자에게 보여주면 우회 실험을
 * 돕는다. 호출부는 이 값을 `console.error`에만 넣고 응답에는 고정 문구를 쓴다.
 */
export class ImageModerationError extends Error {
  constructor(
    readonly kind: ImageModerationKind,
    readonly detail: string,
  ) {
    super(detail)
    this.name = "ImageModerationError"
  }
}

/** GetObject가 없는 키에 대해 내는 이름. 지역에 따라 NotFound로 오는 경우도 있다. */
function isMissingObject(err: unknown): boolean {
  if (!err || typeof err !== "object" || !("name" in err)) return false
  return err.name === "NoSuchKey" || err.name === "NotFound"
}

/**
 * 차단한 사진은 지운다. 버킷이 CloudFront로 `/*` 공개라 **글에 안 걸어도 URL을 알면 열린다.**
 *
 * 최선 노력이다 — 삭제가 실패해도 차단은 그대로 유지한다. 지우지 못한 것을 이유로
 * 통과시키면 유해한 사진이 붙은 글이 올라간다. 실패는 로그로만 남긴다.
 */
async function deleteBlockedObject(bucket: string, s3Key: string): Promise<void> {
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: s3Key }))
  } catch (err) {
    console.error("[imageModeration] 차단 이미지 삭제 실패:", s3Key, err)
  }
}

/** 로그에 남길 위반 정책 이름. 카테고리 세부는 담지 않는다. */
function blockedReason(result: ApplyGuardrailCommandOutput): string {
  const policies = new Set<string>()
  for (const assessment of result.assessments ?? []) {
    if (assessment.contentPolicy) policies.add("content")
    if (assessment.topicPolicy) policies.add("topic")
    if (assessment.wordPolicy) policies.add("word")
    if (assessment.sensitiveInformationPolicy) policies.add("sensitiveInformation")
    if (assessment.contextualGroundingPolicy) policies.add("contextualGrounding")
  }
  return policies.size > 0 ? `정책 위반(${[...policies].join(", ")})` : "GUARDRAIL_INTERVENED"
}

/**
 * 통과하면 그냥 반환한다. 막아야 하면 `ImageModerationError`를 던진다.
 *
 * **`verifyCommunityObject()`를 부르지 않는다.** 아래 ContentType·ContentLength 검사가
 * 그 함수가 하던 일을 그대로 하고, 여기는 어차피 GetObject로 객체를 읽으므로
 * HeadObject 왕복을 하나 아낀다.
 */
export async function moderateImage(s3Key: string): Promise<void> {
  const bucket = process.env.S3_BUCKET?.trim()
  if (!bucket) {
    throw new ImageModerationError("CHECK_FAILED", "S3_BUCKET이 설정되지 않았습니다")
  }

  const guardrailIdentifier = process.env.BEDROCK_GUARDRAIL_ID?.trim()
  const guardrailVersion = process.env.BEDROCK_GUARDRAIL_VERSION?.trim()
  if (!guardrailIdentifier || !guardrailVersion) {
    // fail-closed. 설정이 없으면 "검사 안 함"이 아니라 "확인 못 함"이다.
    throw new ImageModerationError(
      "CHECK_FAILED",
      "BEDROCK_GUARDRAIL_ID / BEDROCK_GUARDRAIL_VERSION이 설정되지 않았습니다",
    )
  }

  let object
  try {
    object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: s3Key }))
  } catch (err) {
    // PUT 없이 키만 보낸 경우다. 서버 오류가 아니라 클라이언트가 만든 상황이므로 차단이다.
    if (isMissingObject(err)) {
      throw new ImageModerationError("BLOCKED", `객체가 없습니다: ${s3Key}`)
    }
    throw new ImageModerationError("CHECK_FAILED", `GetObject 실패: ${String(err)}`)
  }

  const contentType = object.ContentType ?? ""
  const format = GUARDRAIL_FORMAT[contentType]
  if (!format) {
    await deleteBlockedObject(bucket, s3Key)
    throw new ImageModerationError("BLOCKED", `판정할 수 없는 ContentType: ${contentType || "(없음)"}`)
  }

  const contentLength = object.ContentLength ?? 0
  if (contentLength <= 0 || contentLength > MAX_IMAGE_BYTES) {
    await deleteBlockedObject(bucket, s3Key)
    throw new ImageModerationError("BLOCKED", `크기가 범위를 벗어났습니다: ${contentLength}바이트`)
  }

  let bytes: Uint8Array
  try {
    if (!object.Body) throw new Error("본문이 비어 있습니다")
    bytes = await object.Body.transformToByteArray()
  } catch (err) {
    throw new ImageModerationError("CHECK_FAILED", `본문을 읽지 못했습니다: ${String(err)}`)
  }

  let result: ApplyGuardrailCommandOutput
  try {
    result = await bedrock.send(
      new ApplyGuardrailCommand({
        guardrailIdentifier,
        guardrailVersion,
        // 사용자가 올린 것을 판정하는 자리라 INPUT이다.
        source: "INPUT",
        content: [{ image: { format, source: { bytes } } }],
      }),
    )
  } catch (err) {
    // 타임아웃·자격증명·리소스 오류 전부 여기로 온다. **통과시키지 않는다**(머리 주석).
    throw new ImageModerationError("CHECK_FAILED", `ApplyGuardrail 실패: ${String(err)}`)
  }

  if (result.action === "GUARDRAIL_INTERVENED") {
    await deleteBlockedObject(bucket, s3Key)
    throw new ImageModerationError("BLOCKED", blockedReason(result))
  }
}
