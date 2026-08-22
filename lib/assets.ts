// 소유자: A. 펫·치장 그림의 URL을 만드는 유일한 경로.
//
// 전에는 화면 네 곳이 각자 `${process.env.CLOUDFRONT_DOMAIN}/${key}`를 조립하고,
// CLOUDFRONT_DOMAIN이 비면 null을 돌려 이모지로 떨어졌다. 문제가 두 개였다.
//   1) CloudFront가 모든 경로에 403을 준다(2026-08-22 실측). 값이 있어도 그림이 안 뜬다.
//   2) 조립 규칙이 네 군데에 복사돼 있어 한 곳만 고치면 조용히 어긋난다.
//
// 그래서 시트에서 잘라낸 30장을 public/art 아래에 굽고(scripts/slice-art.ts) 거기서 읽는다.
// Amplify Hosting이 public/을 자기 CloudFront로 내보내므로 CDN을 잃는 것도 아니다.
// 사용자 업로드(미션 사진·글 이미지)는 여전히 S3 presigned URL을 쓴다 — 그 경로는 여기가 아니다.

/** public/art 아래의 정적 자산 경로. key는 "pets/fox-3.png" 같은 시드 키다 */
export function assetUrl(key: string): string {
  return `/art/${key.replace(/^\/+/, "")}`
}

/** 스킨 한 종의 단계별 그림. imageKeyBase는 prisma/seed/items.ts가 정한다 */
export function petImageUrl(imageKeyBase: string, stage: number): string {
  return assetUrl(`${imageKeyBase}-${stage}.png`)
}
