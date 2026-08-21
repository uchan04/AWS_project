// 소유자: C. 펫 방 배경. Figma Make export의 RoomBackground를 옮겼다.
//
// ⚠ 이 SVG는 **데모다.** 방 배경은 나중에 이미지로 교체한다(2026-08-21 사용자 확인).
// 그림을 더 예쁘게 다듬는 데 시간을 쓰지 않는다 — 어차피 갈아치울 자리다.
// 교체 지점은 아래 <svg className="pet-room__bg"> 하나다. 같은 클래스를 붙인
// <img>로 바꾸면 pet.css의 크기·자르기(object-fit)가 그대로 적용된다.
// 이미지 URL을 어디서 받을지(착용한 배경 치장 아이템 vs 고정 배경)는 팀 확인 대기 중이다.
// 이미지가 없을 때의 기본 배경으로 이 SVG를 남길지도 그때 같이 정한다.
//
// export와 다른 점 두 가지:
//  1) 색을 fill 속성에 하드코딩하지 않고 클래스로 뺐다. pet.css가 var(--tribe) 파생으로
//     칠하므로 종족이 바뀌면 벽·커튼·러그 색이 따라 바뀐다. 바닥과 창밖 하늘은
//     종족과 무관한 사물이라 고정색이다
//  2) export는 좌표에 %를 썼는데 <path>의 d 속성은 %를 지원하지 않아 커튼 두 장이
//     아예 렌더되지 않았다. viewBox 좌표계(400×300)로 다시 썼다
//
// 장식이므로 aria-hidden이다. 방 안의 정보는 전부 옆 카드에 글자로 있다.

const WALL_H = 210 // 300의 70%
const STRIPE_COUNT = 13
const PLANK_COUNT = 9

export default function PetRoom() {
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
