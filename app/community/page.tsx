import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"

const DEFAULT_GALLERY = "INDEPENDENT_LOW_INCOME"

/** 커뮤니티 진입점. 본인 종족 갤러리로 보낸다. 진단 전이면 기본 갤러리를 보여준다. */
export default async function CommunityPage() {
  const user = await getCurrentUser()
  redirect(`/community/${user.typeCode ?? DEFAULT_GALLERY}`)
}
