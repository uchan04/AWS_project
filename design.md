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

**색의 출처는 Figma 프로토타입이다** (`isol-design_Figma/README.md` "디자인 규칙" 절).
그 hex를 그대로 쓴다. OKLCH로 변환하지 않는다 — 두 곳의 값이 갈라지면 그게 다음 버그다.
순수 검정·흰색은 쓰지 않는다. 회색은 따뜻한 쪽으로 물들어 있다.

| 토큰 | 값 | 용도 |
|---|---|---|
| `--color-paper` | `#F5F0E8` | 배경 |
| `--color-paper-2` | `#EDE5D0` | 캔버스. 비활성 면 |
| `--color-card` | `#FDFBF5` | 카드·행·입력창 |
| `--color-ink` | `#2A1F14` | 본문 |
| `--color-ink-2` | `#4A3B29` | 보조 본문 |
| `--color-muted` | `#7A6B58` | 캡션 |
| `--color-rule` | `#DDD0BC` | 카드 테두리·구분선 |
| `--color-rule-2` | `#8F8069` | 입력창 테두리 (종이색 대비 3.39:1) |
| `--color-accent` | `#4B7A5B` | 주색. CTA |
| `--color-strong` | `#A9542A` | 강조. 화살표·hover |
| `--color-focus` | `#1F4D33` | 포커스 링 3px |
| `--color-error` | `#B3261E` | 오류 |

`--color-muted`와 `--color-strong`은 명암비 4.5:1을 맞추려고 조정한 값이다(Figma 원본
`#9A8A76`·`#C97B4B`는 AA 미달). **더 밝게 바꾸지 않는다.**

**채도가 높은 색은 종족색 하나뿐**이고, 그것도 원판 하나로 면적을 제한한다. 사용자마다
다른 종족색이 화면의 유일한 색 사건이 되도록 나머지를 비운다.

종족색은 `lib/types.ts`의 `TRIBE[].colorHex`와 `styles/tokens.css`의 `[data-tribe="…"]`가
같은 값을 든다. 한쪽만 바꾸지 않는다. 화면에서 `style={{ backgroundColor: … }}`는 쓰지 않고
루트에 `data-tribe={typeCode}`만 붙인다.

- `HEALTH_EMOTION`(여우 🦊) `#E8956A`
- `INDEPENDENT_LOW_INCOME`(고양이 🐱) `#6A95C8`
- `FAMILY_LIVING`(곰 🐻) `#7AAE82`

이전 값(`#F59E0B` / `#38BDF8` / `#34D399`)은 종이색 배경에서 형광으로 떠 보이고 초록이
주색 `#4B7A5B`와 부딪혀서 버렸다.

펫 이미지가 S3에 올라오기 전까지 마스코트는 이모지다(`TRIBE[].emoji`). 장식이므로 항상
`aria-hidden="true"`를 붙이고, 종족명은 옆에 글자로 따로 쓴다.

다크 모드는 두지 않는다. 종이색 한 벌로 간다.

## Typography

Hallmark 폰트 목록에는 한글 폰트가 없다. 한글 서비스라 대체가 필요하다.

폰트도 Figma 값을 쓴다.

- Display: Gowun Dodum 400 (제목·종족명). 굵기가 400 하나뿐이므로 **700을 주지 않는다.**
  합성 볼드가 되어 글자가 흐려진다. 제목 대비는 크기와 서체 차이로 낸다
- Body: Noto Sans KR 400 / 강조 700
- Outlier: 없음. 두 벌로 끝낸다.
- 굵기 대비: 본문 400 / 라벨·CTA 700. 500은 쓰지 않는다(600은 웹폰트에 없다)
- 배율 1.25, 본문 16px 기준. 질문 제목은 `clamp(1.5625rem, 3.5vw + 0.75rem, 1.9531rem)`
- Arial·Helvetica·system-only는 쓰지 않는다.

## Spacing

4pt 9단. 값은 `styles/tokens.css`에 있다. 화면에서는 `var(--space-md)`처럼 이름으로만 쓴다.

## Motion

- easing: `--ease-out` `--ease-in` `--ease-in-out`
- duration: `--dur-micro` 120ms / `--dur-short` 220ms / `--dur-long` 420ms
- 애니메이션은 `transform`과 `opacity`만 건드린다.
- 이 앱이 쓰는 모션은 **네 개뿐**이다. 앞의 둘은 Figma의 `fadeSlideIn`·`float`를 그대로 옮겼다.
  등장(`.hm-fade` = opacity + `translateY(10px)`), 마스코트(`.hm-float` = 3s 상하 8px),
  누름(`translateY(1px)`), 카드 hover(그림자 + `translateY(-1px)`).
- 스크롤 연동 애니메이션, 확대(scale), 등장 스태거는 쓰지 않는다.
- `prefers-reduced-motion: reduce`에서 150ms 이하로 줄이고, 누름·hover 이동을 없애고,
  `.hm-float`는 **끈다**. 반복 애니메이션은 시간만 줄이면 빠르게 깜빡여 더 나쁘다.

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
- 이모지는 마스코트 자리(원판·배지)에만 쓴다. 문장 안이나 버튼 라벨에는 넣지 않는다.
  펫 이미지가 오면 원판 안의 이모지만 이미지로 바뀐다.

## 화면이 반드시 공유하는 것

- 종이색·먹색, accent, 포커스 색
- Gowun Dodum + Noto Sans KR
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
