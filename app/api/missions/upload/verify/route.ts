import { getCurrentUserWithSkin } from "@/lib/auth"
import { calculateReward } from "@/lib/reward"
import { prisma } from "@/lib/prisma"
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime"
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3"
import { NextRequest, NextResponse } from "next/server"

const bedrock = new BedrockRuntimeClient({ region: process.env.BEDROCK_REGION })
const s3 = new S3Client({ region: process.env.AWS_REGION })

interface VerifyRequest {
  missionId: string
  fileKey: string
}

interface VisionToolResult {
  passed: boolean
  reason: string
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserWithSkin()
    const body = (await req.json()) as VerifyRequest

    if (!body.missionId || !body.fileKey) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "missionId와 fileKey가 필요합니다" } },
        { status: 400 }
      )
    }

    // 미션 조회
    const mission = await prisma.mission.findUnique({ where: { id: body.missionId } })
    if (!mission) {
      return NextResponse.json({ error: { code: "MISSION_NOT_FOUND", message: "미션을 찾을 수 없습니다" } }, { status: 404 })
    }

    if (!mission.requiresPhoto) {
      return NextResponse.json(
        { error: { code: "NOT_PHOTO_MISSION", message: "사진 인증 미션이 아닙니다" } },
        { status: 400 }
      )
    }

    // S3에서 이미지 가져오기
    const bucket = process.env.S3_BUCKET
    if (!bucket) {
      return NextResponse.json(
        { error: { code: "S3_NOT_CONFIGURED", message: "S3 버킷이 설정되지 않았습니다" } },
        { status: 500 }
      )
    }

    const getCmd = new GetObjectCommand({ Bucket: bucket, Key: body.fileKey })
    const s3Response = await s3.send(getCmd)
    const imageBytes = await s3Response.Body?.transformToByteArray()

    if (!imageBytes) {
      return NextResponse.json(
        { error: { code: "IMAGE_READ_FAILED", message: "이미지를 읽을 수 없습니다" } },
        { status: 500 }
      )
    }

    // 이미지 포맷 판단 (파일 확장자 기반)
    let imageFormat: "jpeg" | "png" | "gif" | "webp" = "jpeg"
    if (body.fileKey.endsWith(".png")) imageFormat = "png"
    else if (body.fileKey.endsWith(".webp")) imageFormat = "webp"
    else if (body.fileKey.endsWith(".gif")) imageFormat = "gif"

    // Bedrock Vision 호출
    const visionModelId = process.env.BEDROCK_VISION_MODEL_ID || "us.amazon.nova-2-lite-v1:0"

    const prompt = `이 사진이 다음 미션을 완료한 것인지 판단해 주세요:

미션: ${mission.title}
설명: ${mission.description}

사진이 미션 내용과 맞는지 확인하고, toolUse로 결과를 반환하세요.`

    const command = new ConverseCommand({
      modelId: visionModelId,
      messages: [
        {
          role: "user",
          content: [
            {
              image: {
                format: imageFormat,
                source: { bytes: imageBytes },
              },
            },
            { text: prompt },
          ],
        },
      ],
      toolConfig: {
        tools: [
          {
            toolSpec: {
              name: "verify_mission",
              description: "미션 사진 인증 결과를 반환합니다",
              inputSchema: {
                json: {
                  type: "object",
                  properties: {
                    passed: {
                      type: "boolean",
                      description: "미션을 완료했는지 여부",
                    },
                    reason: {
                      type: "string",
                      description: "판정 이유",
                    },
                  },
                  required: ["passed", "reason"],
                },
              },
            },
          },
        ],
        toolChoice: { tool: { name: "verify_mission" } },
      },
    })

    const response = await bedrock.send(command)
    const toolUse = response.output?.message?.content?.find((c) => "toolUse" in c)

    if (!toolUse || !("toolUse" in toolUse) || !toolUse.toolUse) {
      return NextResponse.json(
        { error: { code: "VISION_FAILED", message: "이미지 검증에 실패했습니다" } },
        { status: 500 }
      )
    }

    const result = toolUse.toolUse.input as unknown as VisionToolResult

    if (!result.passed) {
      return NextResponse.json({
        data: {
          passed: false,
          reason: result.reason,
        },
      })
    }

    // 미션 완료 처리
    const today = new Date().toISOString().slice(0, 10)
    const resetKey = mission.scope === "DAILY" ? today : "STAGE"

    // 중복 완료 확인
    const existing = await prisma.userMission.findUnique({
      where: {
        userId_missionId_resetKey: {
          userId: user.id,
          missionId: mission.id,
          resetKey,
        },
      },
    })

    if (existing) {
      return NextResponse.json({
        data: {
          passed: true,
          alreadyCompleted: true,
          reason: result.reason,
        },
      })
    }

    // 보상 계산
    const baseReward = {
      seeds: mission.rewardSeeds,
      starShards: mission.rewardShards,
      affinity: mission.rewardAffinity,
    }
    const finalReward = calculateReward(user.activePetSkin, baseReward)

    // 미션 완료 + 보상 지급
    await prisma.$transaction([
      prisma.userMission.create({
        data: {
          userId: user.id,
          missionId: mission.id,
          resetKey,
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: {
          seeds: { increment: finalReward.seeds || 0 },
          starShards: { increment: finalReward.starShards || 0 },
          affinity: { increment: finalReward.affinity || 0 },
        },
      }),
    ])

    return NextResponse.json({
      data: {
        passed: true,
        alreadyCompleted: false,
        reason: result.reason,
        reward: finalReward,
      },
    })
  } catch (err) {
    if ((err as Error).message === "로그인이 필요합니다") {
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다" } }, { status: 401 })
    }

    console.error("사진 검증 실패:", err)
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "검증 중 오류가 발생했습니다" } },
      { status: 500 }
    )
  }
}
