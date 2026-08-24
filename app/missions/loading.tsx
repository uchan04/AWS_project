// 2026-08-24 B 추가. /pet·/community와 같은 이유다.
//
// 다만 /missions는 사정이 조금 다르다. page.tsx는 서버에서 DB를 읽지 않고 클라이언트
// 컴포넌트(MissionDashboard)를 그리기만 한다. 그래서 RSC 응답은 빠르지만, 화면이 마운트된
// 뒤에야 GET /api/missions가 나가고 그 응답이 약 1.2초다(RDS가 us-east-1이라 DB 8쿼리
// 병렬 배치 하나가 약 800ms, 인증 조회 왕복이 앞에 200ms 더 붙는다).
//
// 이 파일이 없으면 그 사이 "미션을 불러오는 중..." 한 줄만 뜨고 레이아웃이 완성될 때
// 화면이 통째로 튄다. 실제 구조와 같은 자리에 뼈대를 두면 데이터가 그 자리에 채워진다.
//
// 종족색을 모르는 시점이므로 캐릭터 색을 쓰지 않는다. 중립 회색으로 두고 실제 화면이
// 오면 그때 종족색으로 갈린다.
export default function MissionsLoading() {
  return (
    <div style={{ padding: "32px 20px", maxWidth: 840, margin: "0 auto" }}>
      <header style={{ textAlign: "center", marginBottom: 32 }}>
        <div className="mx-auto mb-3 h-16 w-16 animate-pulse rounded-full bg-neutral-200" />
        <h1
          style={{
            fontFamily: "'Gowun Dodum', sans-serif",
            fontSize: 26,
            color: "#2A1F14",
            margin: "0 0 8px",
          }}
        >
          오늘의 미션
        </h1>
        <p style={{ fontSize: 14, color: "#7A6B58", margin: 0 }}>불러오고 있어요</p>
      </header>

      <div className="animate-pulse" aria-hidden="true">
        {/* 진척 카드 3장 (오늘 달성률 · 이번 주 · 연속 달성) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 12,
            marginBottom: 24,
          }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                background: "#FDFBF5",
                border: "1.5px solid #EDE5D0",
                borderRadius: 16,
                padding: "18px 14px",
              }}
            >
              <div className="mx-auto h-3 w-16 rounded bg-neutral-200" />
              <div className="mx-auto mt-3 h-5 w-12 rounded bg-neutral-200" />
            </div>
          ))}
        </div>

        {/* 출석 캘린더 */}
        <div
          style={{
            background: "#FDFBF5",
            border: "1.5px solid #EDE5D0",
            borderRadius: 20,
            padding: 20,
            marginBottom: 36,
          }}
        >
          <div className="h-4 w-24 rounded bg-neutral-200" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, marginTop: 16 }}>
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className="h-14 rounded-xl bg-neutral-200" />
            ))}
          </div>
        </div>

        {/* 일일 미션 · 추가 미션 두 구역. 각각 헤더 + 카드 4장 */}
        {[0, 1].map((section) => (
          <div key={section} style={{ marginBottom: 36 }}>
            <div style={{ marginBottom: 14 }}>
              <div className="h-5 w-24 rounded bg-neutral-200" />
              <div className="mt-1.5 h-3 w-40 rounded bg-neutral-200" />
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                gap: 12,
              }}
            >
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    background: "#FDFBF5",
                    border: "1.5px solid #EDE5D0",
                    borderRadius: 16,
                    padding: "18px 14px",
                  }}
                >
                  <div className="mx-auto h-8 w-8 rounded-full bg-neutral-200" />
                  <div className="mx-auto mt-2 h-3 w-4/5 rounded bg-neutral-200" />
                  <div className="mx-auto mt-2 h-2.5 w-12 rounded bg-neutral-200" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="sr-only" role="status">
        미션을 불러오고 있어요
      </p>
    </div>
  )
}
