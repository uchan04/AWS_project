import { cdnUrl } from "@/lib/assets"

/**
 * 커뮤니티 메인 캐러셀에 도는 이미지.
 *
 * **2026-08-27부터 슬라이드가 전부 이미지 한 종류다.** 희망 문구도 텍스트로 그리지 않고
 * 이미지로 만들어 첫 장에 둔다 — 슬라이드마다 다른 마크업을 쓰던 분기가 사라졌다.
 *
 * 원본은 1024×141(7.26:1)이고 본문 폭(max-w-5xl = 1024px)에 맞춰 만든다.
 * 이미지는 기존 CloudFront 버킷의 `banners/` 접두에 올린다 — 새 버킷·새 도메인이
 * 필요 없고, 그래서 middleware.ts의 CSP(img-src)도 손댈 것이 없다. CSP는 origin
 * 단위로 허용하는데 그 origin이 `lib/assets.ts`의 cdnOrigin() 하나에서 나오기 때문이다.
 *
 * ## 번호 ↔ 배너 대응표
 *
 *   banners/hope1.png  — 희망 문구(공통 1장, 항상 첫 장)
 *   banners/banner1.jpg — 동작구 청년 마음건강센터
 *   banners/banner2.jpg — 강남구 청년 마음 힐링 테라피
 *   banners/banner3.jpg — 우리·끼리 미션챌린지
 *   banners/banner4.jpg — 어쩌다 청년생활(강서구 청년의 날)
 *
 * **파일명이 순번이라 alt가 유일한 식별자다. 배너를 교체하면 alt도 함께 바꾼다.
 * 한쪽만 바꾸면 조용히 어긋난다** — banner2.jpg를 다른 그림으로 갈아끼우고 alt를
 * 그대로 두면, 화면에는 새 배너가 뜨는데 스크린리더는 옛 배너를 읽는다.
 * 그런 어긋남은 눈으로 확인할 수 없어 오래 남는다.
 */
export type PromoBanner = {
  /** S3/CloudFront 키. 확장자까지 포함한다 */
  key: string
  /** 이미지에 적힌 내용. 장식이 아니라 정보성이라 빈 alt를 쓰지 않는다 */
  alt: string
  /** 신청·안내 링크. 링크가 정해지면 여기 채운다. null이면 <a>로 감싸지 않는다 */
  href: string | null
}

/**
 * 희망 문구 이미지. **갤러리 구분 없이 공통 1장이다.**
 *
 * 갤러리별로 나누려면 이 상수를 `Record<GalleryType, PromoBanner>`로 바꾸고
 * `HopeBanner`에서 gallery로 고르면 된다. 지금은 종족별 문구를 이미지로 4벌 만들 이유가
 * 없어 한 장으로 둔다(문구 원본 20개는 `_lib/banner.ts`에 그대로 있다).
 *
 * ★★ **alt는 이미지 속 문구와 글자 그대로 같아야 한다. 확인 필요.** ★★
 * 아래 값은 이미지를 보지 않고 적은 임시값이다. 이미지에 실제로 적힌 문장으로
 * 반드시 교체하라 — 화면에는 A가 보이는데 스크린리더는 B를 읽는 상태가 되면
 * 눈으로 확인할 수 없어 오래 남는다.
 *
 * **확장자를 코드가 문자열로 박고 있다. 광고는 .jpg, 희망 이미지는 .png다**
 * (2026-08-27 S3 실측: banners/ 아래에 banner1~4.jpg와 hope1.png가 있다).
 * S3에서 파일을 바꾸면 여기도 함께 고쳐야 한다. 안 고치면 CloudFront가 403을 주고
 * (OAC라 없는 파일도 404가 아니라 403이다) **그 장만 조용히 빠진다** —
 * URL은 정상으로 만들어지므로 오류도 로그도 없이 캐러셀이 4장으로 돈다.
 */
export const HOPE_BANNER: PromoBanner = {
  key: "banners/hope1.png",
  alt: "여기선 아무 말이나 해도 괜찮아요.",
  href: null,
}

export const PROMO_BANNERS: readonly PromoBanner[] = [
  {
    key: "banners/banner1.jpg",
    alt: "동작구 청년 마음건강센터 운영 안내. 만 19~34세 대상, 상담과 치료비를 지원합니다. 문의 02-820-9540",
    href: null,
  },
  {
    key: "banners/banner2.jpg",
    alt: "강남구 청년을 위한 마음 힐링 테라피. 만 19~39세 대상, 심신 이완과 요가 프로그램을 9월 3일부터 10월 29일까지 총 8회 진행합니다. 문의 02-3423-8790",
    href: null,
  },
  {
    key: "banners/banner3.jpg",
    alt: "우리·끼리 미션챌린지. 6주 마음정비 온·오프라인 과정입니다",
    href: null,
  },
  {
    key: "banners/banner4.jpg",
    alt: "어쩌다 청년생활. 강서구 청년의 날 행사로 생활 정보와 컬러 코칭 프로그램을 진행합니다",
    href: null,
  },
]

/**
 * 배너 키 → 절대 URL. 도메인이 비면 null이고, 호출부는 그 배너를 목록에서 뺀다.
 *
 * **`cdnUrl()`을 직접 부르지 않고 여기를 거치는 이유는 인코딩이다.** 그 함수는
 * `${origin}/${key}`로 조립만 하고 이스케이프를 하지 않는다(lib/assets.ts). 키에 한글이나
 * 공백이 들어가면 그대로 URL에 실려 브라우저가 다르게 해석하거나 CloudFront가 404를 준다.
 *
 * 슬래시는 경로 구분자라 살리고 각 구간만 encodeURIComponent를 태운다.
 *
 * **지금 키는 전부 ASCII라 결과가 입력과 똑같다 — 그래도 걷어내지 마라.** 나중에
 * 한글 파일명을 올려도 깨지지 않게 하는 안전장치다. 없는 상태에서 한글 키가 들어오면
 * 브라우저마다 다르게 해석하거나 CloudFront가 키를 못 찾는데, 그때는 원인이
 * 인코딩이라는 것이 화면에 드러나지 않는다(403 한 줄뿐이다).
 *
 * 조립 규칙 자체는 여전히 `lib/assets.ts` 한 곳이다 — 그 파일을 고치지 않는다.
 */
export function bannerUrl(key: string): string | null {
  const encoded = key.split("/").map(encodeURIComponent).join("/")
  return cdnUrl(encoded)
}
