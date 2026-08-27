// 2026-08-21 A 추가. page.tsx가 force-dynamic 서버 컴포넌트라 DB 2회 왕복(약 900ms) 동안
// RSC 응답이 끝나지 않는다. 이 파일이 없으면 App Router가 이동을 커밋하지 않아
// 그 900ms 내내 이전 화면이 그대로 멈춰 있고, 탭을 눌렀는데 아무 일도 안 난 것처럼 보인다.
// 이 파일이 있으면 즉시 여기로 전환되고 글 목록이 오는 대로 실제 화면이 갈린다.
//
// 2026-08-23: 골격을 page.tsx의 실제 순서(제목 → 탭 → 배너 → 글 목록)에 맞췄다.
// 뼈대가 실제 배치와 다르면 전환 순간에 요소가 자리를 옮겨 레이아웃이 튄다.
// <h1>과 sr-only 안내는 실물 텍스트로 남긴다 — 스크린리더에는 회색 사각형이
// 아무 정보도 아니고, 여기가 어디이며 무엇을 기다리는지는 말해 줘야 한다.
export default function CommunityLoading() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl text-ink">커뮤니티</h1>
          <div className="mt-2 h-3.5 w-56 animate-pulse rounded bg-paper-2" aria-hidden="true" />
        </div>
        <div className="h-10 w-28 animate-pulse rounded-full bg-paper-2" aria-hidden="true" />
      </div>

      <div className="animate-pulse space-y-6" aria-hidden="true">
        {/* GalleryTabs — 전체 갤러리 + 내 종족 갤러리 2개 */}
        <div className="flex gap-2">
          <div className="h-9 w-24 rounded-full bg-paper-2" />
          <div className="h-9 w-32 rounded-full bg-paper-2" />
        </div>

        {/* HopeBanner (SPEC 9절) */}
        <div className="h-16 rounded-card bg-paper-2/70" />

        {/* PostList. 4장을 둔다 — 3장이면 첫 화면 아래가 비어 보여 로딩이 끝난 것처럼 읽힌다 */}
        <div className="space-y-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-3 rounded-card bg-card p-5 sm:h-[360px]">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-paper-2" />
                <div className="h-3.5 w-24 rounded bg-paper-2" />
              </div>
              <div className="h-3 w-full rounded bg-paper-2" />
              <div className="h-3 w-4/5 rounded bg-paper-2" />
              <div className="flex gap-3 pt-1">
                <div className="h-3 w-12 rounded bg-paper-2" />
                <div className="h-3 w-12 rounded bg-paper-2" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="sr-only">글 목록을 불러오고 있어요</p>
    </main>
  )
}
