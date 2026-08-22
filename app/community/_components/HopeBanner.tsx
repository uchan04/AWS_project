import { TRIBE } from "@/lib/types"
import type { GalleryTab } from "../_lib/gallery"
import { pickHopeMessage } from "../_lib/banner"

/**
 * 희망 문구 배너(SPEC.md 9절). 서버 컴포넌트다 — 상호작용이 없어 클라이언트로 내릴 이유가 없다.
 *
 * 색은 유저의 종족이 아니라 지금 보고 있는 gallery를 따른다. 전체 탭에서는 중립색,
 * 종족 갤러리에서는 그 종족색이라 배너가 "지금 어느 공간에 있는지"를 같이 알려준다.
 */
export function HopeBanner({ gallery }: { gallery: GalleryTab }) {
  const isAll = gallery === "ALL"
  const tribe = isAll ? null : TRIBE[gallery]

  return (
    <div
      className={"flex items-center gap-4 rounded-2xl border p-5 " + (isAll ? "border-neutral-200 bg-neutral-50" : "")}
      // 종족색은 Tailwind로 표현할 수 없어 인라인이다. 22/55는 PostCard의 연한 배경 관습을 따른다.
      style={tribe ? { backgroundColor: `${tribe.colorHex}22`, borderColor: `${tribe.colorHex}55` } : undefined}
    >
      <span aria-hidden="true" className="text-4xl">
        {tribe ? tribe.emoji : "🌿"}
      </span>
      {/* 라벨과 문구는 한 <p> 안의 인라인 span 두 개다. 세로로 쌓지 않는다. */}
      <p className="text-base leading-relaxed text-neutral-900">
        {tribe && (
          // 글자라 종족색 원본을 쓴다. 22/55 알파는 면(배경·테두리)용이라 글자에 쓰면 안 읽힌다.
          <span className="font-bold" style={{ color: tribe.colorHex }}>
            {tribe.animal}족에게:{" "}
          </span>
        )}
        {pickHopeMessage(gallery)}
      </p>
    </div>
  )
}
