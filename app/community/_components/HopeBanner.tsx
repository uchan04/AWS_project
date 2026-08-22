import type { TypeCode } from "@prisma/client"
import { TRIBE } from "@/lib/types"
import { hopeMessageOfWeek } from "../_lib/hope"

// 희망 문구 배너(SPEC 9절). 서버 컴포넌트다 — 문구가 주 단위로만 바뀌므로
// 클라이언트에서 계산할 이유가 없고, 서버에서 고르면 하이드레이션 불일치도 없다.
//
// 전체 갤러리는 종족이 없어 TRIBE에 키가 없다. WriteModal·ChatPanel과 같은 방식으로
// 중립색을 이 파일에 둔다(lib/types.ts는 공유 파일이라 건드리지 않는다).
const NEUTRAL_COLOR = "#9CA3AF"

export function HopeBanner({ gallery }: { gallery: TypeCode | "ALL" }) {
  const accent = gallery === "ALL" ? NEUTRAL_COLOR : TRIBE[gallery].colorHex

  return (
    // 왼쪽 굵은 선만 종족 색으로 둔다. 배경 전체를 종족 색으로 채우면 글 목록보다
    // 배너가 먼저 눈에 들어와 커뮤니티가 공지판처럼 보인다.
    // color-mix로 같은 색의 아주 옅은 배경을 만든다 — 종족마다 색 상수를 또 두지 않는다.
    //
    // <aside>가 아니라 <div>다. Sidebar가 이미 <aside>를 쓰고 있어서 이름 없는
    // complementary 랜드마크가 둘이 되면 스크린리더 랜드마크 목록이 혼란해진다.
    <div
      className="hope-banner rounded-2xl border-l-4 px-5 py-4"
      style={{ borderLeftColor: accent, backgroundColor: `color-mix(in srgb, ${accent} 8%, white)` }}
    >
      <p className="text-[11px] font-semibold tracking-wide text-neutral-500">이번 주의 말</p>
      <p className="mt-1.5 text-sm leading-relaxed font-medium text-neutral-800">
        {hopeMessageOfWeek()}
      </p>
    </div>
  )
}
