import "@/styles/tokens.css"
import "./pet.css"

// 2026-08-21 A 추가. page.tsx가 force-dynamic 서버 컴포넌트라 DB 3회 왕복(약 900ms) 동안
// RSC 응답이 끝나지 않는다. 이 파일이 없으면 App Router가 이동을 커밋하지 않아
// 그 900ms 내내 이전 화면이 그대로 멈춰 있고, 탭을 눌렀는데 아무 일도 안 난 것처럼 보인다.
// 이 파일이 있으면 즉시 여기로 전환되고 데이터가 오는 대로 실제 화면이 갈린다.
//
// 2026-08-21 C(머지): 뼈대를 .hm-pet에서 .pet 어휘로 옮겼다. 두 가지 이유다.
// - .hm-pet은 이제 없는 클래스다. 상점 이관 때 pet.css에서 걷어냈고 tokens.css에는
//   원래 없던 이름이라 아무 규칙에도 걸리지 않는다
// - 실제 /pet은 종이색 전면 배경 + 2단 그리드다. 흰 .hm--canvas 카드로 뜨면 900ms 뒤
//   배경색과 폭이 동시에 튄다 — 이 파일이 없애려던 그 "화면이 덜컥거리는" 느낌이 형태만
//   바꿔 남는다. 자리와 색을 미리 잡아두면 실제 데이터가 그 자리에 채워진다
//
// 종족색을 모르는 시점이므로 data-tribe를 붙이지 않는다. --tribe는 tokens.css :root
// 기본값(accent)으로 떨어지고, 진짜 화면이 오면 그때 종족색으로 갈린다.
export default function PetLoading() {
  return (
    <main className="pet">
      <div className="pet__top">
        <div>
          <h1 className="pet__title">나의 펫</h1>
          <p className="pet__lede">불러오고 있어요</p>
        </div>
      </div>

      <div className="pet__grid" aria-hidden="true">
        <div className="pet__col pet__col--room">
          <div className="pet-room animate-pulse" />
          <div className="pet-card animate-pulse">
            <div className="h-4 w-20 rounded bg-neutral-200" />
            <div className="h-3 w-full rounded bg-neutral-200" />
          </div>
        </div>

        <div className="pet__col">
          {/* 경험치·방치형·씨앗 투입 카드 3장 자리 */}
          {[0, 1, 2].map((i) => (
            <div className="pet-card animate-pulse" key={i}>
              <div className="h-4 w-24 rounded bg-neutral-200" />
              <div className="h-3 w-full rounded bg-neutral-200" />
              <div className="h-3 w-2/3 rounded bg-neutral-200" />
            </div>
          ))}
        </div>
      </div>

      <p className="sr-only" role="status">
        펫 정보를 불러오고 있어요
      </p>
    </main>
  )
}
