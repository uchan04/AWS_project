import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { randomBytes } from "crypto"

const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
})

const BUCKET = process.env.S3_BUCKET || ""
const ALLOWED_TYPES = ["image/jpeg", "image/png"]
const MAX_SIZE = 3 * 1024 * 1024 // 3MB

export type PresignResult = {
  uploadUrl: string
  s3Key: string
  expiresIn: number
}

/**
 * S3 presigned URL 발급.
 * 서버가 key를 결정하고 클라이언트가 임의 key를 쓸 수 없게 한다.
 */
export async function generatePresignedUrl(params: {
  userId: string
  missionId: string
  contentType: string
  fileSize: number
}): Promise<PresignResult> {
  const { userId, missionId, contentType, fileSize } = params

  if (!ALLOWED_TYPES.includes(contentType)) {
    throw new Error("허용되지 않은 파일 형식입니다")
  }

  if (fileSize > MAX_SIZE) {
    throw new Error("파일 크기는 3MB 이하여야 합니다")
  }

  const ext = contentType === "image/jpeg" ? "jpg" : "png"
  const randomId = randomBytes(8).toString("hex")
  const s3Key = `missions/${userId}/${missionId}/${randomId}.${ext}`

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
    ContentType: contentType,
  })

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 })

  return {
    uploadUrl,
    s3Key,
    expiresIn: 300,
  }
}

/**
 * S3 객체 존재·소유권 확인.
 * verify에서 다시 체크해 다른 사용자 key 사용 방지.
 */
export async function verifyS3Object(params: {
  s3Key: string
  userId: string
  missionId: string
}): Promise<{ contentType: string; contentLength: number }> {
  const { s3Key, userId, missionId } = params

  // key prefix 검증
  const expectedPrefix = `missions/${userId}/${missionId}/`
  if (!s3Key.startsWith(expectedPrefix)) {
    throw new Error("잘못된 S3 키입니다")
  }

  try {
    const command = new HeadObjectCommand({
      Bucket: BUCKET,
      Key: s3Key,
    })

    const result = await s3.send(command)

    if (!result.ContentType || !ALLOWED_TYPES.includes(result.ContentType)) {
      throw new Error("허용되지 않은 파일 형식입니다")
    }

    if (!result.ContentLength || result.ContentLength > MAX_SIZE) {
      throw new Error("파일 크기가 초과되었습니다")
    }

    return {
      contentType: result.ContentType,
      contentLength: result.ContentLength,
    }
  } catch (err: any) {
    if (err.name === "NotFound") {
      throw new Error("업로드된 파일을 찾을 수 없습니다")
    }
    throw err
  }
}
