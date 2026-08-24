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
  const origin = cdnOrigin()
  if (!origin) return null
  return `${origin}/${key.replace(/^\/+/, "")}`
}

/**
 * CLOUDFRONT_DOMAIN을 스킴 붙은 origin으로. 비어 있으면 null.
 *
 * 따로 내보내는 이유는 CSP다(2026-08-24). `middleware.ts`의 img-src에 이 origin이
 * 없으면 브라우저가 그림을 **전부 차단**한다 — 8/24에 그림 출처를 CloudFront로
 * 바꾸면서 실제로 그렇게 됐고, 로컬 실행에서 `pets/fox-4.png` 차단 로그로 잡았다.
 * 조립 규칙이 두 벌이면 한쪽만 고쳐도 같은 증상이 다시 나므로 규칙은 여기 한 곳이다.
 */
export function cdnOrigin(): string | null {
  const raw = process.env.CLOUDFRONT_DOMAIN?.trim().replace(/\/+$/, "")
  if (!raw) return null
  return /^https?:\/\//.test(raw) ? raw : `https://${raw}`
}

/**
 * 스킨 한 종의 단계별 그림. imageKeyBase는 prisma/seed/items.ts가 정한다.
 * 확장자는 여기서 붙인다 — imageKeyBase에는 없다("pets/fox" + "-3.png").
 */
export function petImageUrl(imageKeyBase: string, stage: number): string | null {
  return cdnUrl(`${imageKeyBase}-${stage}.png`)
}
