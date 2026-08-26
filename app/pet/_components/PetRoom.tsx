// 소유자: C. 펫 방 배경. Figma Make export의 RoomBackground를 옮겼다.
//
// 이 SVG는 **기본 배경이다** (2026-08-21 사용자 확정). 배경 치장(배경1~배경6)을
// 상점에서 사서 착용하기 전까지 이 방이 나온다. 그림을 더 다듬는 데 시간을 쓰지 않는다 —
// 착용한 유저에게는 안 보이고, 지금은 아무도 배경을 갖고 있지 않아 전원이 이 방을 본다.
//
// 착용 중이면 그 배경 이미지를 이 SVG **위에** 덮는다. 지우고 갈아 끼우지 않는 이유는
// 이미지가 안 뜰 때(CloudFront 403·미업로드) 빈 방이 되지 않게 하려는 것이다.
// 그래서 배경 이미지는 **불투명 전체 그림**이어야 한다 — 투명 PNG면 두 방이 겹쳐 보인다.
// (그 경우에도 아래 방이 새어 나오지는 않게 pet.css가 img에 불투명 배경을 깔아 둔다)
//
// 카펫(러그)은 **배경에 속하는 요소다** (2026-08-21 사용자 확정). 다른 배경 그림에는
// 카펫이 없으므로 별도 레이어로 빼지 않고 이 SVG 안에 둔다 — 배경이 갈리면 카펫도 같이 간다.
//
// export와 다른 점 두 가지:
//  1) 색을 fill 속성에 하드코딩하지 않고 클래스로 뺐다. pet.css가 var(--tribe) 파생으로
//     칠하므로 종족이 바뀌면 벽·커튼·러그 색이 따라 바뀐다. 바닥과 창밖 하늘은
//     종족과 무관한 사물이라 고정색이다
//  2) export는 좌표에 %를 썼는데 <path>의 d 속성은 %를 지원하지 않아 커튼 두 장이
//     아예 렌더되지 않았다. viewBox 좌표계(400×300)로 다시 썼다
//
// 장식이므로 aria-hidden이다. 방 안의 정보는 전부 옆 카드에 글자로 있다.

import { ArtImage } from "@/app/components/ArtImage"

const WALL_H = 210 // 300의 70%
const STRIPE_COUNT = 13
const PLANK_COUNT = 9

// ── 책장 (2026-08-26 사용자 요청으로 화분을 갈았다) ────────────────────────────
//
// **x가 24 → 64로 옮겨 간 이유는 잘림이다.** 이 SVG는 preserveAspectRatio="xMidYMid slice"
// 라서 방이 세로로 길어지면 좌우가 잘린다. 방 폭 352 · 높이 352일 때 배율이
// max(352/400, 352/300) = 1.173이고 잘려 나가는 폭이 한쪽 (469 − 352) / 2 = 58.5px =
// **50 좌표**다. 옛 화분(x 16~56)은 그 안에 거의 다 들어가서 화면에서는 왼쪽 끝에 초록
// 조각만 보였다. 64에서 시작하면 그 폭에서도, 넓은 방(잘림 7좌표)에서도 온전히 보인다.
// 벽에 붙여 세운 물건이라는 읽기는 그대로다 — 왼쪽 여백이 조금 늘어난 것뿐이다.
const SHELF_X = 64
const SHELF_W = 60
const SHELF_TOP = 126
const SHELF_BOTTOM = 204 // 걸레받이 윗선. 옛 화분 밑면과 같은 값이라 서는 자리가 안 바뀐다
const SHELF_BOARD_H = 4
// 선반 4장의 윗면 y. 첫 장이 천판, 마지막이 밑판이고 사이 두 장이 칸을 셋으로 가른다
const SHELF_BOARDS = [SHELF_TOP, 152, 178, SHELF_BOTTOM - SHELF_BOARD_H]

// 칸마다 책 5권. 폭을 조금씩 달리해 손으로 꽂은 것처럼 보이게 한다 —
// 다 같은 폭이면 격자로 읽혀 책장이 아니라 표가 된다.
// 좌우로 5씩 들여 시작하므로 안쪽 폭이 50이고, 폭 합(35) + 틈 4 = 39이라 오른쪽이
// 11만큼 빈다. **꽉 채우지 않는 것이 의도다** — 다 채우면 책이 벽에 눌린 것으로 보인다.
const SHELF_ROWS = [
  { base: 152, widths: [7, 5, 9, 6, 8] },
  { base: 178, widths: [6, 9, 5, 8, 7] },
  { base: SHELF_BOTTOM - SHELF_BOARD_H, widths: [8, 6, 7, 5, 9] },
]

// 책 사각형을 미리 계산한다. JSX 안에서 x를 누적하면 map이 부수효과를 갖게 된다.
// 높이는 18/16/14 셋을 돌린다 — 위 칸 높이가 가장 낮은 곳(밑칸 18)에서도 위 선반에
// 닿지 않는 값이다(밑칸: 200 − 18 = 182, 그 위 선반 밑면이 182).
const SHELF_BOOKS = SHELF_ROWS.flatMap((row, ri) => {
  let x = SHELF_X + 5
  return row.widths.map((w, bi) => {
    const h = 18 - ((ri + bi) % 3) * 2
    const book = { key: `${ri}-${bi}`, x, y: row.base - h, w, h, tone: (ri * 2 + bi) % 4 }
    x += w + 1
    return book
  })
})

export default function PetRoom({ imageUrl }: { imageUrl?: string | null }) {
  return (
    <>
      <RoomSvg />
      {imageUrl ? (
        // 착용한 배경 치장. 기본 방을 덮는다. 안 뜨면 스스로 숨어 아래 방이 다시 보인다
        // 방 카드 폭(최대 720px)을 꽉 채운다. 원본은 770×288이고 .pet-room__bg가
        // absolute inset:0 · object-fit:cover로 늘린다
        <ArtImage
          className="pet-room__bg pet-room__bg--img"
          src={imageUrl}
          width={720}
          height={269}
          decorative
        />
      ) : null}
    </>
  )
}

function RoomSvg() {
  return (
    <svg
      className="pet-room__bg"
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* 벽 */}
      <rect className="pet-room__wall" width="400" height={WALL_H} />
      {Array.from({ length: STRIPE_COUNT }).map((_, i) => (
        <rect
          className="pet-room__stripe"
          key={i}
          x={i * 32}
          y={0}
          width={16}
          height={WALL_H}
        />
      ))}

      {/* 바닥 */}
      <rect className="pet-room__floor" y={WALL_H} width="400" height={300 - WALL_H} />
      {Array.from({ length: PLANK_COUNT }).map((_, i) => (
        <rect
          className="pet-room__plank"
          key={i}
          x={i * 46}
          y={WALL_H}
          width={44}
          height={300 - WALL_H}
          rx={2}
        />
      ))}

      {/* 걸레받이 */}
      <rect className="pet-room__trim" y={WALL_H - 6} width="400" height={9} />

      {/* 창 */}
      <rect className="pet-room__sky" x={288} y={15} width={88} height={114} rx={8} />
      <rect className="pet-room__frame" x={288} y={15} width={88} height={114} rx={8} />
      <line className="pet-room__frame-bar" x1={332} y1={15} x2={332} y2={129} />
      <line className="pet-room__frame-bar" x1={288} y1={72} x2={376} y2={72} />

      {/* 커튼 */}
      <path className="pet-room__curtain" d="M 288 15 Q 296 72 288 129 L 280 129 L 280 15 Z" />
      <path className="pet-room__curtain" d="M 376 15 Q 368 72 376 129 L 384 129 L 384 15 Z" />

      {/* 책장. 2026-08-26 사용자 요청으로 화분(pot + leaf 3장)을 갈았다.
          뒷판을 먼저 깔고 선반 4장을 그 위에, 책을 맨 위에 둔다 — 순서를 바꾸면
          불투명한 뒷판이 책을 덮는다 (파일 위 SHELF_* 상수의 좌표 근거 참고) */}
      <rect
        className="pet-room__shelf"
        x={SHELF_X}
        y={SHELF_TOP}
        width={SHELF_W}
        height={SHELF_BOTTOM - SHELF_TOP}
        rx={2}
      />
      {SHELF_BOOKS.map((b) => (
        <rect
          className="pet-room__book"
          data-tone={b.tone}
          key={b.key}
          x={b.x}
          y={b.y}
          width={b.w}
          height={b.h}
          rx={1}
        />
      ))}
      {SHELF_BOARDS.map((y) => (
        <rect
          className="pet-room__shelf-board"
          key={y}
          x={SHELF_X}
          y={y}
          width={SHELF_W}
          height={SHELF_BOARD_H}
          rx={1}
        />
      ))}
      {/* 여기에 책장 위 "일기장" 딱지(`.pet-room__shelf-label`)가 있었다 —
          천판 위 6좌표, 책장 가로 가운데, --font-body 10좌표였다.
          **2026-08-26 같은 날 사용자 요청으로 지웠다.** 되살릴 값은 그 한 줄이고
          자리는 `x={SHELF_X + SHELF_W / 2} y={SHELF_TOP - 6}`이다.
          CSS 규칙도 함께 걷었다(pet.css의 그 자리 주석) */}

      {/* 러그 */}
      <ellipse className="pet-room__rug" cx={200} cy={246} rx={120} ry={24} />
      <ellipse className="pet-room__rug-line" cx={200} cy={246} rx={100} ry={18} />
    </svg>
  )
}
