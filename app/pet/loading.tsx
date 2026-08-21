import "@/styles/tokens.css"
import "./pet.css"

// 2026-08-21 A 추가. page.tsx가 force-dynamic 서버 컴포넌트라 DB 3회 왕복(약 900ms) 동안
// RSC 응답이 끝나지 않는다. 이 파일이 없으면 App Router가 이동을 커밋하지 않아
// 그 900ms 내내 이전 화면이 그대로 멈춰 있고, 탭을 눌렀는데 아무 일도 안 난 것처럼 보인다.
// 이 파일이 있으면 즉시 여기로 전환되고 데이터가 오는 대로 실제 화면이 갈린다.
export default function PetLoading() {
  return (
    <main className="hm hm--canvas">
      <div className="hm__col hm-pet">
        <h1 className="hm-card__title">펫</h1>
        <div className="hm-card">
          <div className="animate-pulse space-y-4" aria-hidden="true">
            <div className="mx-auto h-40 w-40 rounded-full bg-neutral-200" />
            <div className="mx-auto h-4 w-24 rounded bg-neutral-200" />
            <div className="h-3 w-full rounded bg-neutral-200" />
            <div className="h-3 w-2/3 rounded bg-neutral-200" />
          </div>
          <p className="hm__note sr-only">펫 정보를 불러오고 있어요</p>
        </div>
      </div>
    </main>
  )
}
