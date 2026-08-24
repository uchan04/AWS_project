import type { MetadataRoute } from "next"

// PWA 매니페스트. /manifest.webmanifest 로 서비스된다.
//
// 왜 넣는가: 이 서비스는 사실상 모바일 웹앱이다(하단 탭 내비게이션, 375px 기준 레이아웃).
// 매니페스트가 없으면 iOS·안드로이드에서 "홈 화면에 추가"를 해도 브라우저 주소창이 남고
// 이름이 URL로 뜬다. 고립은둔청년이 매일 여는 앱이라 홈 화면 진입이 실제 사용 빈도를 바꾼다.
//
// 아이콘은 app/icon.svg 하나를 쓴다. purpose maskable을 같이 주면 안드로이드가
// 원형으로 잘라도 새싹이 잘리지 않는다(여백이 이미 아이콘 안에 있다).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "함께 걷는 하루",
    short_name: "하루",
    description: "오늘 하루의 작은 걸음을 함께 걷습니다.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F5F0E8",
    theme_color: "#F5F0E8",
    lang: "ko",
    dir: "ltr",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  }
}
