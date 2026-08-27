import { TRIBE } from "@/lib/types"
import type { GalleryTab } from "../_lib/gallery"
import { pickHopeMessage } from "../_lib/banner"

/**
 * 희망 문구 배너(SPEC.md 9절). 서버 컴포넌트다 — 상호작용이 없어 클라이언트로 내릴 이유가 없다.
 *
 * 색은 유저의 종족이 아니라 지금 보고 있는 gallery를 따른다. 전체 탭에서는 중립색,
 * 종족 갤러리에서는 그 종족색이라 배너가 "지금 어느 공간에 있는지"를 같이 알려준다.
 *
 * **카드가 아니라 띠(band)로 그린다(2026-08-26).** 예전에는 `rounded-2xl border p-5`라
 * 사방 테두리에 둥근 모서리였는데, 그건 이 화면에서 **실제로 눌리는 것들의 어휘였다** —
 * 탭, 오프라인 모임 입구 링크, 글 카드가 전부 같은 모양이라 배너만 안 눌린다는 것을
 * 형태로 구분할 방법이 없었다("눌릴 것 같다"는 피드백의 원인).
 *
 * 그래서 사방 테두리를 좌측 accent bar 하나로 줄이고 왼쪽 모서리를 각지게 뒀다.
 * 여기에 hover·active·cursor-pointer·transition을 **붙이지 마라.** 누를 수 없는 요소이고,
 * 하나라도 붙는 순간 이 피드백이 그대로 돌아온다.
 */
export function HopeBanner({ gallery }: { gallery: GalleryTab }) {
  const isAll = gallery === "ALL"
  const tribe = isAll ? null : TRIBE[gallery]

  return (
    <div
      className={
        // 왼쪽은 각지게(rounded-r-xl) — 모서리를 둥글리면 accent bar가 끊겨 다시 카드로 읽힌다.
        "flex items-center gap-4 rounded-r-xl border-l-4 px-5 py-4 " +
        (isAll ? "border-l-neutral-300 bg-neutral-50" : "")
      }
      // 종족색은 Tailwind로 표현할 수 없어 인라인이다. 배경 22는 PostCard의 연한 배경 관습을 따른다.
      // bar는 얇아서 알파를 섞으면 안 보인다 — 원색을 그대로 쓴다.
      style={tribe ? { backgroundColor: `${tribe.colorHex}22`, borderLeftColor: tribe.colorHex } : undefined}
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
