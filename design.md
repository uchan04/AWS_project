# Design — 함께 걷는 하루

이 앱의 잠긴 디자인 시스템이다. 화면을 새로 만들거나 고칠 때 이 문서를 먼저 읽는다.
페이지마다 다시 정하지 않는다. 시스템을 키워야 하면 이 문서를 고친 다음 화면을 고친다.

토큰 구현은 `styles/tokens.css` 한 곳에 있다. 화면에서는 `import "@/styles/tokens.css"`로 불러오고
루트 요소에 `className="hm"`을 붙인다.

## 왜 이 범위인가

`app/globals.css`와 `app/layout.tsx`는 E 소유다(CLAUDE.md 1절). 그래서 전역 스타일을 고치지 않고
`styles/tokens.css`를 새로 만들어 `.hm` 안으로 범위를 가둔다. 웹폰트도 `layout.tsx`의 `<link>`가 아니라
CSS `@import`로 불러온다. 새 npm 의존성은 추가하지 않는다.

## Genre

editorial (tone: soft)

고립은둔청년 서비스다. 화면이 활발하면 압박이 된다. 조용한 종이 위의 편집물처럼 만든다.
playful은 쓰지 않는다.

## Macrostructure family

- App pages(진단 문항): **Conversational FAQ** — 질문 하나가 화면의 주인공이고 선택지가 짧은 답이다.
- App pages(결과): **Photographic** — 종족판 하나가 화면을 지배하고 글자는 작은 캡션이다.
  펫 이미지가 S3에 올라오면 원판 자리를 이미지로 바꾼다. 구조는 그대로 쓴다.
- App pages(홈): **Index-First** — 홈은 링크 목록이다. 히어로를 두지 않는다.

화면 전체를 채우는 가운데 정렬 히어로는 쓰지 않는다. 진단 전 홈도 위에서 아래로 읽히게 둔다.

## Theme

색은 OKLCH로만 쓴다. 순수 검정·흰색은 쓰지 않는다. 회색은 따뜻한 쪽으로 물들인다.

- `--color-paper`   oklch(97.6% 0.008 78)
- `--color-paper-2` oklch(94.6% 0.011 76)
- `--color-paper-3` oklch(91.5% 0.013 74)
- `--color-ink`     oklch(27% 0.014 62)
- `--color-ink-2`   oklch(42% 0.013 62)
- `--color-muted`   oklch(50% 0.012 66)
- `--color-rule`    oklch(89% 0.01 72)
- `--color-rule-2`  oklch(67% 0.014 70)
- `--color-accent`  oklch(52% 0.058 44)
- `--color-accent-ink` oklch(97.6% 0.008 78)
- `--color-focus`   oklch(34% 0.085 250)
- `--color-error`   oklch(52% 0.17 25)

강조색(accent)은 채도를 낮춘 흙빛이다. **채도가 높은 색은 종족색 하나뿐**이고, 그것도 원판
하나로 면적을 제한한다. 사용자마다 다른 종족색이 화면의 유일한 색 사건이 되도록 나머지를 비운다.

종족색은 `lib/types.ts`의 `TRIBE[].colorHex`를 그대로 OKLCH로 옮겨 `styles/tokens.css`의
`[data-tribe="…"]` 규칙에 둔다. 화면에서 `style={{ backgroundColor: … }}`로 색을 넣지 않는다.
루트에 `data-tribe={typeCode}`만 붙이면 `--tribe`가 정해진다.

- `HEALTH_EMOTION`(여우) oklch(76.9% 0.163 70) ← `#F59E0B`
- `INDEPENDENT_LOW_INCOME`(고양이) oklch(78.6% 0.126 225) ← `#38BDF8`
- `FAMILY_LIVING`(곰) oklch(78.2% 0.145 165) ← `#34D399`

다크 모드는 두지 않는다. 종이색 한 벌로 간다.

## Typography

Hallmark 폰트 목록에는 한글 폰트가 없다. 한글 서비스라 대체가 필요하다.

- Display: Gowun Batang 700 (부드러운 한글 명조. 제목·종족명)
- Body: IBM Plex Sans KR 400 (Hallmark 본문 허용 목록의 IBM Plex Sans 한글판)
- Outlier: 없음. 두 벌로 끝낸다.
- 굵기 대비: 본문 400 / 제목 700 = 300단위
- 배율 1.25, 본문 16px 기준. 질문 제목은 `clamp(1.5625rem, 3.5vw + 0.75rem, 1.9531rem)`
- Arial·Helvetica·system-only는 쓰지 않는다.

## Spacing

4pt 9단. 값은 `styles/tokens.css`에 있다. 화면에서는 `var(--space-md)`처럼 이름으로만 쓴다.

## Motion

- easing: `--ease-out` `--ease-in` `--ease-in-out`
- duration: `--dur-micro` 120ms / `--dur-short` 220ms / `--dur-long` 420ms
- 애니메이션은 `transform`과 `opacity`만 건드린다.
- 이 앱이 쓰는 모션은 **두 개뿐**이다: 누름(`translateY(1px)`), 문항 교체(opacity 페이드).
- 스크롤 연동 애니메이션, 카드 hover 확대, 등장 스태거는 쓰지 않는다.
- `prefers-reduced-motion: reduce`에서 150ms 이하로 줄이고 누름 이동을 없앤다.

## Microinteractions stance

- 성공은 조용히 넘어간다. "완료!" 토스트를 띄우지 않는다.
- 닉네임 검사는 blur 이후에만 한다. 첫 타이핑부터 빨간 글씨를 띄우지 않는다.
- 오류는 색만으로 알리지 않는다. 테두리 + 글리프 + 문장 + `aria-invalid`를 함께 쓴다.
- 포커스 링은 즉시 나타난다. 절대 애니메이션하지 않는다.
- hover 효과는 `@media (hover: hover)` 안에만 둔다. 터치에서 상태가 눌러붙지 않게.

## CTA voice

- Primary: accent 채움, pill 모양, 높이 44px, `--color-accent-ink` 글자. 화면에 하나만.
- Secondary: 테두리만 있는 pill.
- Tertiary: 밑줄 링크(`.hm-link`). 회색, 44px 터치 영역 확보.
- 종족색은 CTA에 쓰지 않는다. CTA는 모든 화면에서 같은 색이어야 학습이 된다.

## Per-page allowances

- 앱 화면에는 장식을 넣지 않는다. 기능이 화면을 이끈다.
- 색 면적: 종족 원판 1개 + 희석된 판 1개까지. 그 이상 채우지 않는다.

## 화면이 반드시 공유하는 것

- 종이색·먹색, accent, 포커스 색
- Gowun Batang + IBM Plex Sans KR
- CTA 목소리(pill·44px·accent)
- 목록 행(`.hm-row`) 하나가 진단 선택지와 홈 메뉴를 동시에 담당한다
- 최대 폭 30rem, 한 열, 왼쪽 정렬

## 화면이 달라도 되는 것

- macrostructure(위 세 가지 안에서)
- 종족판을 크게 쓸지 작은 원판으로 쓸지

## 모바일 하한선

320 / 375 / 414 / 768px에서 전부 확인한다. 가로 스크롤 없음, 버튼 라벨 2줄 금지,
`dvh` 사용, `100vw` 금지, `html·body`에 `overflow-x: clip`.

## Exports

### tokens.css

`styles/tokens.css`가 정본이다. 이 문서에 값을 복사해 두지 않는다 — 두 곳이 갈라지면 그게 다음 버그다.
