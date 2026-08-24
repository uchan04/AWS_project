// 소유자: A. 펫·치장 그림의 URL을 만드는 유일한 경로.
//
// 화면 여러 곳이 각자 `${process.env.CLOUDFRONT_DOMAIN}/${key}`를 조립하던 것을 여기로 모았다.
// 규칙이 복사돼 있으면 한 곳만 고쳐도 조용히 어긋난다 — 목록과 방 배경이 다른 그림이 되는 식이다.
//
// 2026-08-24: 그림 출처를 CloudFront로 통일했다(사용자 결정). 그 전까지 A쪽은 시트에서
// 잘라낸 PNG를 public/art에 굽고(scripts/slice-art.ts) 거기서 읽었다. 그 파일들은 지금
// 아무도 참조하지 않지만 **지우지 않고 남겨 둔다** — CloudFront가 403을 주던 시기가 있었고
// (2026-08-22 실측) 다시 그렇게 되면 여기 두 함수의 본문만 assetUrl로 돌리면 복구된다.
//
// 사용자 업로드(미션 사진·글 이미지)는 여전히 S3 presigned URL을 쓴다 — 그 경로는 여기가 아니다.

/**
 * CloudFront에 올려 둔 그림의 URL. 도메인이 비면 null (호출부가 칸을 지우거나 이모지로 떨어진다).
 *
 * **스킴을 여기서 붙인다.** CLOUDFRONT_DOMAIN 값에는 스킴이 없어서(2026-08-24 확인)
 * `${domain}/${key}`로 조립하면 `d….cloudfront.net/backgrounds/x.png`라는 **상대 경로**가
 * 된다. 브라우저가 현재 경로에 이어 붙여 `/pet/d….cloudfront.net/…`을 요청하고 404다.
 * COGNITO_DOMAIN에서 같은 함정을 이미 밟았다(lib/oauth.ts cognitoDomain 주석).
 * 콘솔 값에 스킴이 붙어 있어도 두 번 붙지 않게 양쪽을 다 받는다.
 */
export function cdnUrl(key: string): string | null {
  const raw = process.env.CLOUDFRONT_DOMAIN?.trim().replace(/\/+$/, "")
  if (!raw) return null
  const origin = /^https?:\/\//.test(raw) ? raw : `https://${raw}`
  return `${origin}/${key.replace(/^\/+/, "")}`
}

/**
 * 스킨 한 종의 단계별 그림. imageKeyBase는 prisma/seed/items.ts가 정한다.
 * 확장자는 여기서 붙인다 — imageKeyBase에는 없다("pets/fox" + "-3.png").
 */
export function petImageUrl(imageKeyBase: string, stage: number): string | null {
  return cdnUrl(`${imageKeyBase}-${stage}.png`)
}
