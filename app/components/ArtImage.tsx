"use client"

import Image from "next/image"
import type { CSSProperties } from "react"

// public/art 그림 한 장. 7곳이 같은 <img> + onError 블록을 복사해 갖고 있었다.
//
// **왜 next/image로 바꿨나 — 파일 크기다.**
// 구워 둔 30장이 5.6MB다(scripts/slice-art.ts). 최악은 치장 목록 화면으로,
// 배경 치장 6종이 각각 770×288 PNG 380~560KB인데 화면에는 가로 160px 칸에 뜬다.
// 한 화면에 3MB를 내려받고 그중 95%를 버린다. next/image를 통과하면 브라우저가
// 받는 것은 표시 크기로 줄인 WebP다.
//
// 새 의존성이 아니다 — 변환은 next가 이미 들고 있는 sharp가 한다. scripts/slice-art.ts가
// "sharp를 넣지 않는다"고 적어 둔 것은 **빌드 스크립트에 네이티브 모듈을 넣지 않겠다**는
// 뜻이고, 여기는 런타임 최적화기라 그 결정과 어긋나지 않는다.
//
// **크기는 여전히 CSS가 정한다.** width/height는 최적화기가 어느 해상도를 구울지
// 고르는 힌트로만 쓴다. 그래서 표시되는 크기를 그대로 넘긴다 — 원본 픽셀(380×267)을
// 넘기면 56px 칸에 384px 그림이 내려온다.
export function ArtImage({
  src,
  alt = "",
  width,
  height,
  className,
  style,
  decorative = false,
  fallbackDisplay,
}: {
  src: string
  /** 장식이면 빈 문자열을 그대로 둔다. 펫처럼 내용이 있는 그림에만 넣는다 */
  alt?: string
  /** 표시 크기(px). 원본 픽셀이 아니다 — 위 주석 참고 */
  width: number
  height: number
  className?: string
  style?: CSSProperties
  /** true면 aria-hidden. alt=""만으로는 일부 스크린리더가 파일명을 읽는다 */
  decorative?: boolean
  /**
   * 그림이 안 뜰 때 바로 뒤 형제(이모지 폴백)를 어떤 display로 켤지.
   * 생략하면 자기만 숨는다 — 방 배경·치장처럼 폴백이 없는 자리다.
   */
  fallbackDisplay?: "block" | "grid"
}) {
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      style={style}
      aria-hidden={decorative || undefined}
      onError={(e) => {
        // 아트가 없거나 최적화기가 실패하면 빈 칸이 남는다. 그 자리를 이모지에 넘긴다
        e.currentTarget.style.display = "none"
        if (!fallbackDisplay) return
        const fallback = e.currentTarget.nextElementSibling as HTMLElement | null
        if (fallback) fallback.style.display = fallbackDisplay
      }}
    />
  )
}
