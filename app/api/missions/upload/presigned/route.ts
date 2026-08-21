import { getCurrentUser } from "@/lib/auth"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { NextResponse } from "next/server"

const s3 = new S3Client({ region: process.env.AWS_REGION })

export async function POST() {
  try {
    const user = await getCurrentUser()

    const fileKey = `mission-photos/${user.id}/${Date.now()}.jpg`
    const bucket = process.env.S3_BUCKET

    if (!bucket) {
      return NextResponse.json(
        { error: { code: "S3_NOT_CONFIGURED", message: "S3 버킷이 설정되지 않았습니다" } },
        { status: 500 }
      )
    }

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: fileKey,
      ContentType: "image/jpeg",
    })

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 })

    return NextResponse.json({
      data: {
        uploadUrl,
        fileKey,
      },
    })
  } catch (err) {
    if ((err as Error).message === "로그인이 필요합니다") {
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다" } }, { status: 401 })
    }

    console.error("Presigned URL 생성 실패:", err)
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "업로드 URL 생성 중 오류가 발생했습니다" } },
      { status: 500 }
    )
  }
}
