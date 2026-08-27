"use client"

import { useEffect, useState } from "react"

/**
 * 커뮤니티 메인 캐러셀. 희망 문구 이미지 1장 + 외부 복지 프로그램 배너 4장을 한 칸에서 돌린다.
 *
 * **2026-08-27: 슬라이드가 전부 이미지 한 종류가 됐다.** 전에는 첫 장만 텍스트라
 * 종족색 배경·왼쪽 바·이모지·문구 크기를 따로 들고 있었고, 화살표를 피하려고 좌우 패딩까지
 * 특별히 줬다. 문구를 이미지로 그리면서 그 분기가 전부 사라졌다.
 *
 * 배너가 하나도 없으면(로컬에서 CLOUDFRONT_DOMAIN이 비어 URL이 전부 null이면) 이 컴포넌트는
 * 아예 렌더되지 않는다 — 그 판단은 부모(HopeBanner)가 한다. 이 파일은 환경변수를 읽지 않고
 * src는 이미 절대 URL이다.
 *
 * 칸 높이는 배너 원본 비율(1024×141)이 정한다. 폭 1024px이면 정확히 141px이라 배너가
 * 축소 없이 들어간다. sm 미만은 비율대로면 38px이라 너무 납작해서 96px로 받친다.
 */

/** 자동 회전 간격. 배너를 읽을 시간과 지루하지 않을 시간 사이 */
const ROTATE_MS = 10_000

export type CarouselBanner = {
  /** bannerUrl()을 이미 거친 절대 URL */
  src: string
  alt: string
  href: string | null
}

export function HopeCarousel({ banners }: { banners: CarouselBanner[] }) {
  const total = banners.length
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  // 자동으로 넘어간 것은 알리지 않는다. 10초마다 스크린리더가 끼어들면 글 목록을
  // 읽는 흐름이 끊긴다. 화살표로 **직접 넘긴 것만** 알린다(본인이 요청한 변화다)
  const [announce, setAnnounce] = useState(false)

  /*
   * 자동 회전. app/pet/_components/PetView.tsx의 말풍선 순환과 같은 꼴이다 —
   * 조건이 맞지 않으면 early return으로 인터벌 자체를 걸지 않고, 정리 함수에서 끈다.
   *
   * prefers-reduced-motion은 이 프로젝트에서 지금까지 CSS로만 처리했다(globals.css의
   * 전역 규칙, Tailwind의 motion-safe:). 자동 회전은 CSS로 끌 수 없는 유일한 종류라
   * 여기서만 matchMedia를 읽는다. **구독(addEventListener)은 하지 않는다** — 보는 도중에
   * 설정을 바꾸는 경우는 드물고, 구독하면 상태가 하나 더 는다.
   */
  useEffect(() => {
    if (total <= 1) return
    if (paused) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const tick = setInterval(() => {
      setAnnounce(false)
      setIndex((prev) => (prev + 1) % total)
    }, ROTATE_MS)
    return () => clearInterval(tick)
  }, [total, paused])

  function go(step: 1 | -1) {
    setAnnounce(true)
    // 첫 장에서 이전을 누르면 마지막 장으로 돈다. total을 더해 음수를 피한다
    setIndex((prev) => (prev + step + total) % total)
  }

  /*
   * 화살표는 띠 위에 얹는다. 밖으로 빼면 띠 폭이 줄어 아래 글 카드 격자와 좌우가 어긋난다.
   *
   * **원을 그리지 않는다.** 배너가 원본 크기로 꽉 차는 자리라, 반투명 원이라도 그림 위에
   * 판을 하나 얹는 셈이다. 배경·테두리·blur를 전부 걷고 글리프만 남겼다.
   * 그래도 h-11 w-11(44px)은 남긴다 — **보이지 않아도 터치 타깃이다.**
   *
   * 색 토큰을 쓰지 않는다. 배너 배경이 분홍·연두·주황·민트로 제각각이라 어느 팔레트 색으로도
   * 대비를 보장할 수 없다. 검은 글리프 + 흰 그림자(Chevron)로, 밝은 배경에서는 글리프가
   * 어두운 배경에서는 그림자 테두리가 형태를 살린다.
   *
   * focus ring은 흰색이다. 배경이 어떤 색일지 모르고, ring-focus(#1F4D33 초록)는
   * 어두운 배경에서 보이지 않는다.
   */
  const ARROW =
    "absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-black/80 transition duration-150 hover:scale-110 hover:text-black focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"

  return (
    <div
      role="region"
      aria-roledescription="캐러셀"
      aria-label="희망 문구와 복지 프로그램 안내"
      // 폭을 여기서 제한하지 않는다. 부모(page.tsx의 flex flex-col)가 폭을 주므로
      // 아래 PostList 격자와 좌우가 정확히 맞는다
      className="relative aspect-[1024/141] min-h-[96px] overflow-hidden rounded-xl border border-rule bg-paper-2 sm:min-h-0"
      // 정지 버튼을 따로 두지 않는다. 읽으려고 머무는 동안 멈추면 충분하고,
      // 키보드 사용자는 화살표에 초점이 가는 순간 멈춘다
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {banners.map((banner, i) => (
        <Slide key={banner.src} index={i} current={index} total={total}>
          {banner.href ? (
            <a href={banner.href} target="_blank" rel="noopener noreferrer" className="block h-full w-full">
              <BannerImage banner={banner} />
            </a>
          ) : (
            <BannerImage banner={banner} />
          )}
        </Slide>
      ))}

      {/* 슬라이드가 하나뿐이면 넘길 것이 없다 */}
      {total > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="이전 배너"
            className={ARROW + " left-2 sm:left-3"}
          >
            <Chevron direction="left" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="다음 배너"
            className={ARROW + " right-2 sm:right-3"}
          >
            <Chevron direction="right" />
          </button>
        </>
      )}

      {/* 라이브 영역은 슬라이드가 아니라 여기다 — 슬라이드에 걸면 alt 전문을 매번 다시 읽는다.
          이제 전부 이미지라 몇 번째인지만 알린다. 자동 회전 중에는 off라 아무것도 알리지 않는다 */}
      <span className="sr-only" aria-live={announce ? "polite" : "off"}>
        {index + 1} / {total}
      </span>
    </div>
  )
}

/**
 * 슬라이드 한 장. 전부 겹쳐 두고 opacity로 갈아 끼운다 —
 * 좌우로 미는 방식은 폭 계산이 필요하고, 이 칸은 한 번에 한 장만 보이면 충분하다.
 *
 * 전부 absolute inset-0이다. 띠가 aspect-ratio로 높이를 가지므로 흐름에 남길 장이 없다.
 *
 * 보이지 않는 장은 pointer-events-none으로 눌리지 않게 하고, aria-hidden으로
 * 스크린리더에서도 숨긴다. 안 그러면 화면에 없는 배너의 alt가 계속 읽힌다.
 */
function Slide({
  index,
  current,
  total,
  children,
}: {
  index: number
  current: number
  total: number
  children: React.ReactNode
}) {
  const shown = index === current

  return (
    <div
      role="group"
      aria-roledescription="슬라이드"
      aria-label={`${index + 1} / ${total}`}
      aria-hidden={!shown}
      className={
        "absolute inset-0 motion-safe:transition-opacity motion-safe:duration-300 " +
        (shown ? "opacity-100" : "pointer-events-none opacity-0")
      }
    >
      {children}
    </div>
  )
}

/**
 * 배너 그림. next/image를 쓰지 않는다 — 설정에 없는 hostname을 만나면 렌더 중에
 * throw한다(PostCard.tsx의 같은 주석 참고). CloudFront는 remotePatterns에 없다.
 *
 * **sm 이상은 object-cover, 그 미만은 object-contain이다.**
 *
 * sm 이상에서는 띠가 배너 원본과 같은 비율(1024/141)이라 cover가 잘라낼 것이 없고
 * 빈틈도 남지 않는다. contain이면 반올림 오차만큼 위아래에 띠 배경이 비친다.
 *
 * sm 미만에서는 min-h-[96px]가 aspect-ratio를 이겨 띠가 약 3.5:1이 된다. 이미지는
 * 7.26:1이라 cover가 **좌우를 절반 가까이 잘라낸다** — 광고 배너는 양끝에 QR코드와
 * 전화번호가 있어 그게 날아가면 배너가 무의미해진다. contain으로 축소해 전체를 보여준다.
 * 위아래 여백이 생기지만 띠에 bg-paper-2가 깔려 있어 의도된 여백으로 읽힌다.
 * 정보가 잘리는 것보다 낫다.
 *
 * 어느 쪽이든 배너를 갈아끼울 때 1024×141을 지키는 것이 이 값의 전제다.
 */
function BannerImage({ banner }: { banner: CarouselBanner }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={banner.src} alt={banner.alt} className="h-full w-full object-contain sm:object-cover" />
  )
}

/**
 * 화살표 글리프. **문자 ‹ ›를 쓰지 않는다** — 서체·행높이에 따라 세로 중심이 어긋나
 * 위아래로 떠 보인다. SVG는 viewBox가 중심을 고정한다.
 *
 * **흰 그림자가 배경 없이 읽히게 하는 핵심이다.** 검은 글리프 둘레에 흰 테두리가 생겨
 * 어두운 배경에서도 형태가 남는다. strokeWidth는 2.5다 — 2면 획이 흰 그림자에 먹힌다.
 */
function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6 sm:h-7 sm:w-7"
      style={{ filter: "drop-shadow(0 1px 2px rgba(255,255,255,0.9))" }}
    >
      <polyline points={direction === "left" ? "15 18 9 12 15 6" : "9 18 15 12 9 6"} />
    </svg>
  )
}
