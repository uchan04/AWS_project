import { NextRequest } from "next/server"

const DEBUG_TOKEN = "614c678a7c7ccd5480a82108239352d0"

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")
  if (token !== DEBUG_TOKEN) {
    return new Response(null, { status: 404 })
  }

  const keys = [
    "DATABASE_URL",
    "AWS_REGION",
    "BEDROCK_REGION",
    "S3_BUCKET",
    "COGNITO_USER_POOL_ID",
    "SESSION_SECRET",
    "NODE_ENV",
  ]
  const presence = Object.fromEntries(keys.map((k) => [k, k in process.env]))
  return Response.json(presence)
}
