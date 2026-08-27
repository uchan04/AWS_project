import { HOPE_BANNER, PROMO_BANNERS, bannerUrl } from "../_lib/banners"
import { HopeCarousel, type CarouselBanner } from "./HopeCarousel"

/**
 * 커뮤니티 메인 캐러셀(SPEC.md 9절). **서버 컴포넌트로 남긴다** — 상태가 필요한 회전은
 * `HopeCarousel`("use client")이 맡고, 여기는 키를 URL로 바꾸는 일만 한다.
 *
 * **2026-08-27: 슬라이드가 전부 이미지가 됐다.** 희망 문구도 텍스트로 그리지 않고
 * 이미지 한 장으로 만들어 첫 장에 둔다. 그래서 이 컴포넌트에서 갤러리를 알 필요가 없어졌다 —
 * 종족색·이모지·주간 문구 계산이 전부 빠지고 `gallery` prop도 지웠다.
 * 갤러리별 희망 이미지가 필요해지면 `_lib/banners.ts`의 HOPE_BANNER를 Record로 바꾸고
 * 여기서 고르면 된다(그 파일 주석 참고).
 *
 * **URL이 하나도 만들어지지 않으면 null을 반환한다.** CLOUDFRONT_DOMAIN이 비어 있는
 * 로컬이 그 경우다. 예전에는 문구 슬라이드가 텍스트라 그것만 남았지만, 이제 전부
 * 이미지라 남을 것이 없다 — 빈 액자를 그리느니 자리를 비운다.
 */
export function HopeBanner() {
  /*
   * 키를 절대 URL로 바꾼다. bannerUrl()이 null이면(도메인 미설정) 그 장을 뺀다.
   * 희망 이미지가 첫 장이다 — 배너는 외부 기관 홍보이고 희망 문구는 이 서비스가 하는
   * 말이라, 처음 보이는 것이 남의 배너면 순서가 뒤집힌다.
   */
  const banners: CarouselBanner[] = [HOPE_BANNER, ...PROMO_BANNERS].flatMap((banner) => {
    const src = bannerUrl(banner.key)
    return src ? [{ src, alt: banner.alt, href: banner.href }] : []
  })

  if (banners.length === 0) return null

  return <HopeCarousel banners={banners} />
}
