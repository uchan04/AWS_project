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

      {/* 화분 */}
      <rect className="pet-room__pot" x={24} y={180} width={24} height={24} rx={3} />
      <ellipse className="pet-room__leaf" cx={36} cy={180} rx={20} ry={9} />
      <ellipse className="pet-room__leaf" cx={28} cy={171} rx={12} ry={12} />
      <ellipse className="pet-room__leaf" cx={44} cy={171} rx={12} ry={12} />

      {/* 러그 */}
      <ellipse className="pet-room__rug" cx={200} cy={246} rx={120} ry={24} />
      <ellipse className="pet-room__rug-line" cx={200} cy={246} rx={100} ry={18} />
    </svg>
  )
}
