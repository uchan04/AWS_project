// 2026-08-21 A 추가. page.tsx가 force-dynamic 서버 컴포넌트라 DB 2회 왕복(약 900ms) 동안
// RSC 응답이 끝나지 않는다. 이 파일이 없으면 App Router가 이동을 커밋하지 않아
// 그 900ms 내내 이전 화면이 그대로 멈춰 있고, 탭을 눌렀는데 아무 일도 안 난 것처럼 보인다.
// 이 파일이 있으면 즉시 여기로 전환되고 글 목록이 오는 대로 실제 화면이 갈린다.
export default function CommunityLoading() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <h1 className="text-xl font-bold text-neutral-900">커뮤니티</h1>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-9 w-48 rounded-full bg-neutral-200" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-3 rounded-2xl bg-white p-5">
            <div className="h-4 w-1/3 rounded bg-neutral-200" />
            <div className="h-3 w-full rounded bg-neutral-200" />
            <div className="h-3 w-4/5 rounded bg-neutral-200" />
          </div>
        ))}
      </div>
      <p className="sr-only">글 목록을 불러오고 있어요</p>
    </main>
  )
}
